import { expect } from 'chai';
import { Mongo } from 'meteor/mongo';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Lanes } from '..';
import { Shipments } from '../../shipments';
import { Harbors } from '../../harbors';
import { ShipmentReturns } from '../../shipments/server/returns';
import { start_shipment, end_shipment, recover_shipments } from './methods';

describe('Shipment return publication', () => {
  const restores = [];
  const replace = (target, key, value) => {
    const previous = target[key];
    restores.push(() => { target[key] = previous; });
    target[key] = value;
    return previous;
  };
  const recover = async () => Promise.all(await recover_shipments());
  const start = () => start_shipment('lane', {}, 'planned', 'source');
  const fails = async (work, message) => {
    let error;
    try { await work(); }
    catch (caught) { error = caught; }
    expect(error?.message).to.include(message);
  };
  let effects;
  let result;

  beforeEach(async () => {
    await resetDatabase();
    effects = 0;
    result = { returned: true };
    replace(console, 'error', () => {});
    replace(H, 'harbors', { test: { work: () => {
      effects++;
      return result;
    } } });
    await Lanes.insertAsync({ _id: 'lane', type: 'test' });
  });
  afterEach(() => {
    while (restores.length) restores.pop()();
  });

  it('preserves a typed return after the completed manifest changes',
    async () => {
      result = { record_id: new Mongo.ObjectID(), date: new Date(100000),
        binary: new Uint8Array([1, 2, 3]),
      };
      const first = await start();
      await end_shipment({ _id: 'lane' }, 0,
        { shipment_id: 'source', final_result: true });
      expect(await start()).to.deep.eq(first);
      expect((await Shipments.findOneAsync('source')).manifest.final_result)
        .to.eq(true);
      expect(effects).to.eq(1);
    });

  it('keeps large completed manifests and different returns in separate rows',
    async () => {
      const size = 9 * 1024 * 1024;
      result = { returned: 'r'.repeat(size) };
      H.harbors.test.work = async (lane, manifest) => {
        effects++;
        await end_shipment(lane, 0,
          { ...manifest, completed: 'c'.repeat(size) });
        return result;
      };
      expect((await start()).returned.length).to.eq(size);
      expect((await start()).returned.length).to.eq(size);
      const saved = await Shipments.findOneAsync('source');
      expect(saved.manifest.completed.length).to.eq(size);
      expect(saved.manifest.returned).to.eq(undefined);
      expect(saved.dispatch.return_id).to.be.a('string');
      expect(await ShipmentReturns.find().countAsync()).to.eq(2);
      expect(effects).to.eq(1);
    });

  ['row', 'checkpoint', 'receipt'].forEach(stage => {
    ['before', 'after'].forEach(when => {
      it(`recovers ${when} the return ${stage} write`, async () => {
        const target = stage == 'row' ? ShipmentReturns : Shipments;
        const method = stage == 'row' ? 'upsertAsync' : 'updateAsync';
        const update = target[method];
        replace(target, method, async (...args) => {
          const matches = stage == 'row' || (stage == 'checkpoint' ?
            args[1].$set?.['dispatch.returned'] && !args[0].active :
            args[1].$set?.dispatch?.return_id);
          if (!matches) return update.apply(target, args);
          if (when == 'after') await update.apply(target, args);
          throw new Error('return write unavailable');
        });
        await fails(start, 'return write unavailable');
        target[method] = update;
        await recover();
        if (stage == 'row' && when == 'before') {
          await fails(start, 'unknown');
          expect(await ShipmentReturns.find().countAsync()).to.eq(0);
          expect(effects).to.eq(1);
          return;
        }
        expect(await start()).to.deep.eq(result);
        const saved = await Shipments.findOneAsync('source');
        expect(saved.dispatch.pending).to.eq(undefined);
        expect(await ShipmentReturns.find().countAsync()).to.eq(1);
        expect(effects).to.eq(1);
      });
    });
  });

  it('recovers a captured synchronous return after its lane is deleted',
    async () => {
      H.harbors.test.work = async (lane, manifest) => {
        effects++;
        await end_shipment(lane, 0, manifest);
        return result;
      };
      const upsert = ShipmentReturns.upsertAsync;
      replace(ShipmentReturns, 'upsertAsync', async (...args) => {
        const saved = await upsert.apply(ShipmentReturns, args);
        const source = await Shipments.findOneAsync('source');
        if (args[0] !== source.dispatch.return_id) return saved;
        throw new Error('return acknowledgment lost');
      });
      await fails(start, 'acknowledgment lost');
      ShipmentReturns.upsertAsync = upsert;
      await Lanes.removeAsync('lane');
      await recover();
      expect(await start()).to.deep.eq(result);
      expect(effects).to.eq(1);
    });

  it('holds an uncaptured synchronous return instead of inventing one',
    async () => {
      H.harbors.test.work = async (lane, manifest) => {
        effects++;
        await end_shipment(lane, 0, manifest);
        return result;
      };
      const upsert = ShipmentReturns.upsertAsync;
      replace(ShipmentReturns, 'upsertAsync', async (...args) => {
        const source = await Shipments.findOneAsync('source');
        if (args[0] !== source.dispatch.return_id) {
          return upsert.apply(ShipmentReturns, args);
        }
        throw new Error('return unavailable');
      });
      await fails(start, 'return unavailable');
      ShipmentReturns.upsertAsync = upsert;
      await recover();
      const saved = await Shipments.findOneAsync('source');
      expect(saved.active).to.eq(false);
      expect(saved.dispatch.pending).to.eq(false);
      expect(saved.dispatch.error).to.include('reconcile');
      await fails(start, 'reconcile');
      expect(effects).to.eq(1);
    });

  ['checkpoint', 'receipt'].forEach(stage => {
    it(`fences the ${stage} after another owner takes over`, async () => {
      const update = Shipments.updateAsync;
      replace(Shipments, 'updateAsync', async (...args) => {
        const matches = stage == 'checkpoint' ?
          args[1].$set?.['dispatch.returned'] && !args[0].active :
          args[1].$set?.dispatch?.return_id;
        if (matches) {
          await update.call(Shipments, 'source', { $set: {
            'dispatch.token': 'replacement',
            'dispatch.until': new Date(Date.now() + 60000),
          } });
        }
        return update.apply(Shipments, args);
      });
      await fails(start, 'pending');
      expect((await Shipments.findOneAsync('source')).dispatch.token)
        .to.eq('replacement');
      Shipments.updateAsync = update;
      await Shipments.updateAsync('source', {
        $set: { 'dispatch.until': new Date(0) },
      });
      await recover();
      expect(await start()).to.deep.eq(result);
      expect(effects).to.eq(1);
    });
  });

  it('does not reserve a legacy return after losing its claim', async () => {
    await Shipments.insertAsync({ _id: 'source', lane: 'lane', active: false,
      manifest: result, dispatch: { pending: true, returned: true },
    });
    const update = Shipments.updateAsync;
    replace(Shipments, 'updateAsync', async (...args) => {
      if (args[1].$set?.['dispatch.return_id']) {
        await update.call(Shipments, 'source', { $set: {
          'dispatch.token': 'replacement',
        } });
      }
      return update.apply(Shipments, args);
    });
    await recover();
    expect(await ShipmentReturns.find().countAsync()).to.eq(0);
    expect((await Shipments.findOneAsync('source')).dispatch.token)
      .to.eq('replacement');
    expect(effects).to.eq(0);
  });

  it('does not publish a return from a superseded safe-replay attempt',
    async () => {
      let began;
      let release;
      const started = new Promise(resolve => { began = resolve; });
      H.harbors.test.replay_safe = true;
      H.harbors.test.work = async () => {
        const attempt = ++effects;
        if (attempt == 1) {
          began();
          await new Promise(resolve => { release = resolve; });
        }
        return { attempt };
      };
      const first = start();
      await started;
      try {
        const old = await Shipments.findOneAsync('source');
        await Shipments.updateAsync('source', { $set: {
          'dispatch.token': 'expired', 'dispatch.until': new Date(0),
        } });
        expect(await start()).to.deep.eq({ attempt: 2 });
        release();
        await first;
        expect(await start()).to.deep.eq({ attempt: 2 });
        expect((await Shipments.findOneAsync('source')).dispatch.return_id)
          .not.to.eq(old.dispatch.return_id);
        expect(await ShipmentReturns.find().countAsync()).to.eq(1);
      }
      finally { release(); await first; }
    });

  it('reports a missing published return instead of substituting a manifest',
    async () => {
      await start();
      await ShipmentReturns.removeAsync({});
      await fails(start, 'return was not saved');
      expect(effects).to.eq(1);
    });

  it('reads legacy results without requiring a live lane or a new receipt',
    async () => {
      await Shipments.insertAsync({ _id: 'legacy', lane: 'missing',
        active: false, manifest: { legacy: true },
      });
      expect(await start_shipment('missing', {}, 'later', 'legacy'))
        .to.deep.eq({ legacy: true });
      expect(await ShipmentReturns.find().countAsync()).to.eq(0);
      expect(effects).to.eq(0);
    });

  it('keeps a known undefined return if a callback finishes before repair',
    async () => {
      H.harbors.test.work = () => { effects++; return undefined; };
      const update = Shipments.updateAsync;
      replace(Shipments, 'updateAsync', async (...args) => {
        const saved = await update.apply(Shipments, args);
        if (args[1].$set?.['dispatch.returned']) {
          throw new Error('work acknowledgment lost');
        }
        return saved;
      });
      await fails(start, 'acknowledgment lost');
      Shipments.updateAsync = update;
      await end_shipment({ _id: 'lane' }, 0,
        { shipment_id: 'source', callback_result: true });
      await recover();
      expect(await start()).to.eq(undefined);
      expect((await Shipments.findOneAsync('source')).active).to.eq(false);
      expect(effects).to.eq(1);
    });

  it('does not expose result mutation methods or a publication', () => {
    for (const method of ['insert', 'update', 'remove']) {
      expect(H.server.method_handlers[`/ShipmentReturns/${method}`])
        .to.eq(undefined);
    }
    expect(H.server.publish_handlers.ShipmentReturns).to.eq(undefined);
  });

  it('recovers error handling interrupted after its outcome was saved',
    async () => {
      await Lanes.updateAsync('lane', {
        $set: { salvage_plan: { _id: 'salvage' } },
      });
      await Lanes.insertAsync({ _id: 'salvage', type: 'test' });
      await Harbors.insertAsync({ _id: 'test', lanes: {
        salvage: { manifest: {} },
      } });
      H.harbors.test.work = (lane, manifest) => {
        effects++;
        return lane._id == 'lane' ? { ...manifest, error: 'failed' } : result;
      };
      const update = Lanes.updateAsync;
      replace(Lanes, 'updateAsync', async (...args) => {
        const source = await Shipments.findOneAsync('source');
        if (args[0] == 'lane' && args[1].$max && source?.active === false) {
          throw new Error('accounting unavailable');
        }
        return update.apply(Lanes, args);
      });
      await fails(start, 'accounting unavailable');
      Lanes.updateAsync = update;
      await recover();
      await recover();
      expect(await start()).to.deep.eq(result);
      expect(effects).to.eq(2);
      const source = await Shipments.findOneAsync('source');
      expect(source.active).to.eq(false);
      expect(source.manifest.error).to.eq('failed');
      expect(source.completion.pending).to.eq(undefined);
      expect(source.dispatch.pending).to.eq(undefined);
    });

  it('returns the first completion result when a later callback differs',
    async () => {
      await Shipments.insertAsync({ _id: 'source', lane: 'lane', active: true,
        actual: new Date(), manifest: {}, stdout: {}, stderr: {},
      });
      const first = await end_shipment({ _id: 'lane' }, 0,
        { shipment_id: 'source', first: true });
      const repeated = await end_shipment({ _id: 'lane' }, 1,
        { shipment_id: 'source', late: true });
      expect(repeated).to.deep.eq(first);
      expect((await Shipments.findOneAsync('source')).exit_code).to.eq(0);
    });

  it('keeps a parent pending while another worker captures its child return',
    async () => {
      let began;
      let release;
      const started = new Promise(resolve => { began = resolve; });
      H.harbors.test.work = async () => {
        effects++;
        began();
        await new Promise(resolve => { release = resolve; });
        return result;
      };
      const child = start();
      await started;
      try {
        await Lanes.insertAsync({ _id: 'parent', type: 'test' });
        await Shipments.insertAsync({ _id: 'parent-source', lane: 'parent',
          active: false, actual: new Date(), stdout: {}, stderr: {},
          manifest: { shipment_id: 'parent-source' },
          completion: { pending: true, failed: false, next: {
            lane: 'lane', shipment_id: 'source', start: 'planned',
          } },
        });
        const finish = () => end_shipment({ _id: 'parent' }, 0,
          { shipment_id: 'parent-source' });
        await fails(finish, 'pending');
        const parent = await Shipments.findOneAsync('parent-source');
        expect(parent.completion.pending).to.eq(true);
        expect(parent.completion.has_result).to.eq(undefined);
        release();
        await child;
        expect(await finish()).to.deep.eq(result);
        expect(effects).to.eq(1);
      }
      finally { release(); await child; }
    });

  ['checkpoint', 'receipt'].forEach(stage => {
    it(`fences a completion return ${stage} after ownership is lost`,
      async () => {
        await Shipments.insertAsync({ _id: 'source', lane: 'lane', active: true,
          actual: new Date(), manifest: {}, stdout: {}, stderr: {},
        });
        const update = Shipments.updateAsync;
        replace(Shipments, 'updateAsync', async (...args) => {
          const matches = stage == 'checkpoint' ?
            args[1].$set?.['completion.returned'] :
            args[1].$set?.completion?.return_id;
          if (matches) {
            await update.call(Shipments, 'source', { $set: {
              'completion.token': 'replacement',
              'completion.until': new Date(Date.now() + 60000),
            } });
          }
          return update.apply(Shipments, args);
        });
        const finish = () => end_shipment({ _id: 'lane' }, 0,
          { shipment_id: 'source', value: result });
        await fails(finish, 'pending');
        expect((await Shipments.findOneAsync('source')).completion.token)
          .to.eq('replacement');
        Shipments.updateAsync = update;
        await Shipments.updateAsync('source', {
          $set: { 'completion.until': new Date(0) },
        });
        await recover();
        expect((await finish()).value).to.deep.eq(result);
        expect(effects).to.eq(0);
      });
  });

  it('returns the immutable value if another writer wins insertion',
    async () => {
      const upsert = ShipmentReturns.upsertAsync;
      replace(ShipmentReturns, 'upsertAsync', async (...args) => {
        await upsert.call(ShipmentReturns, args[0], {
          $setOnInsert: { value: { captured_first: true } },
        });
        return upsert.apply(ShipmentReturns, args);
      });
      expect(await start()).to.deep.eq({ captured_first: true });
      expect(await start()).to.deep.eq({ captured_first: true });
      expect(effects).to.eq(1);
    });
});
