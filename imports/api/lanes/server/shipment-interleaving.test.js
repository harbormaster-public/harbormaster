import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Lanes } from '..';
import { Shipments } from '../../shipments';
import { ShipmentReturns } from '../../shipments/server/returns';
import {
  start_shipment, end_shipment, recover_shipments,
} from './methods';

describe('Shipment return interleavings', () => {
  const restores = [];
  const replace = (target, key, value) => {
    const previous = target[key];
    restores.push(() => { target[key] = previous; });
    target[key] = value;
    return previous;
  };
  const start = () => start_shipment('lane', {}, 'planned', 'source');
  const recover = async () => Promise.all(await recover_shipments());
  const fails = async (work, message) => {
    let error;
    try { await work(); }
    catch (caught) { error = caught; }
    expect(error?.message).to.include(message);
    return error;
  };
  let effects;

  beforeEach(async () => {
    await resetDatabase();
    effects = 0;
    replace(console, 'error', () => {});
    replace(H, 'harbors', { test: { work: () => {
      effects++;
      return { original_return: true };
    } } });
    await Lanes.insertAsync({ _id: 'lane', type: 'test' });
  });

  afterEach(() => {
    while (restores.length) restores.pop()();
  });

  [false, true].forEach(defined => {
    ['keep', 'delete-lane', 'remove-harbor'].forEach(change => {
      it(`settles a captured return without live work: ${defined}, ${change}`,
        async () => {
          const value = defined ? { returned: true } : undefined;
          H.harbors.test.work = () => { effects++; return value; };
          const update = replace(Shipments, 'updateAsync', async (...args) => {
            const saved = await update.apply(Shipments, args);
            if (args[1].$set?.['dispatch.returned']) {
              throw new Error('checkpoint acknowledgment lost');
            }
            return saved;
          });
          await fails(start, 'checkpoint acknowledgment lost');
          const checkpoint = await Shipments.findOneAsync('source');
          expect(checkpoint.dispatch.returned).to.eq(true);
          expect(checkpoint.dispatch.has_result).to.eq(defined);
          Shipments.updateAsync = update;
          if (change == 'delete-lane') {
            // Retain recovery coverage for a lane removed outside the RPC.
            await Lanes.removeAsync('lane');
          }
          if (change == 'remove-harbor') H.harbors = {};
          await Lanes.insertAsync({ _id: 'parent', type: 'test' });
          await Shipments.insertAsync({
            _id: 'parent-source', lane: 'parent', actual: new Date(),
            active: false, manifest: { shipment_id: 'parent-source' },
            stdout: {}, stderr: {},
            completion: { pending: true, failed: false, next: {
              lane: 'lane', shipment_id: 'source', start: 'planned',
            } },
          });
          expect(await end_shipment({ _id: 'parent' }, 0,
            { shipment_id: 'parent-source' })).to.deep.eq(value);
          expect((await Shipments.findOneAsync('parent-source'))
            .completion.pending).to.eq(undefined);
          await recover();
          expect(await start()).to.deep.eq(value);
          const saved = await Shipments.findOneAsync('source');
          expect(saved.dispatch.pending).to.eq(undefined);
          expect(effects).to.eq(1);
        });
    });
  });

  ['checkpoint', 'manifest'].forEach(stage => {
    ['before', 'after'].forEach(when => {
      it(`retains a defined return after callback and ${when} ${stage} failure`,
        async () => {
          const update = replace(Shipments, 'updateAsync', async (...args) => {
            const matches = stage == 'checkpoint' ?
              args[1].$set?.['dispatch.returned'] :
              args[0].active && args[1].$set?.manifest;
            if (!matches) return update.apply(Shipments, args);
            if (when == 'after') await update.apply(Shipments, args);
            throw new Error('checkpoint unavailable');
          });
          await fails(start, 'checkpoint unavailable');
          expect(await ShipmentReturns.find().countAsync()).to.eq(1);
          Shipments.updateAsync = update;
          await end_shipment({ _id: 'lane' }, 0,
            { shipment_id: 'source', completed_result: true });
          await recover();
          expect(await start()).to.deep.eq({ original_return: true });
          const saved = await Shipments.findOneAsync('source');
          expect(saved.manifest.completed_result).to.eq(true);
          expect(saved.manifest.original_return).to.eq(undefined);
          expect(effects).to.eq(1);
        });
    });
  });

  it('does not mark a return captured before its payload is durable',
    async () => {
      const upsert = replace(ShipmentReturns, 'upsertAsync', async () => {
        throw new Error('result store unavailable');
      });
      await fails(start, 'result store unavailable');
      const checkpoint = await Shipments.findOneAsync('source');
      expect(checkpoint.dispatch.returned).to.eq(undefined);
      expect(checkpoint.manifest.original_return).to.eq(undefined);
      ShipmentReturns.upsertAsync = upsert;
      await end_shipment({ _id: 'lane' }, 0,
        { shipment_id: 'source', completed_result: true });
      await recover();
      await fails(start, 'reconcile');
      expect((await Shipments.findOneAsync('source')).manifest.completed_result)
        .to.eq(true);
      expect(effects).to.eq(1);
    });

  it('propagates completion contention without saving a business failure',
    async () => {
      let release;
      let entered;
      let recovering;
      const began = new Promise(resolve => { entered = resolve; });
      const update = replace(Lanes, 'updateAsync', async (...args) => {
        if (args[0] == 'lane' && args[1].$max &&
          (await Shipments.findOneAsync('source'))?.active === false) {
          entered();
          await new Promise(resolve => { release = resolve; });
        }
        return update.apply(Lanes, args);
      });
      const save = replace(Shipments, 'updateAsync', async (...args) => {
        const result = await save.apply(Shipments, args);
        if (args[1].$set?.completion?.pending &&
          args[1].$set.active === false) {
          recovering = recover();
          await began;
        }
        return result;
      });
      H.harbors.test.work = async (lane, manifest) => {
        effects++;
        return await end_shipment(lane, 0, manifest);
      };
      try {
        const error = await fails(start, 'completion is pending');
        expect(error.error).to.eq('shipment-pending');
      }
      finally {
        Lanes.updateAsync = update;
        release?.();
        await recovering;
      }
      const saved = await Shipments.findOneAsync('source');
      expect(saved.exit_code).to.eq(0);
      expect(saved.manifest.error).to.eq(undefined);
      expect(saved.completion.pending).to.eq(undefined);
      expect(saved.dispatch.pending).to.eq(true);
      expect(await ShipmentReturns.findOneAsync(saved.dispatch.return_id))
        .to.eq(undefined);
      await recover();
      await fails(start, 'reconcile');
      expect(effects).to.eq(1);
    });
});
