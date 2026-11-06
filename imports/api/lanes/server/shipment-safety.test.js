import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Lanes } from '..';
import { Shipments, LatestShipment } from '../../shipments';
import { Harbors } from '../../harbors';
import { ShipmentReturns } from '../../shipments/server/returns';
import { claim_shipment } from './shipment-state';
import {
  start_shipment, end_shipment, recover_shipments,
} from './methods';

describe('Shipment safety', () => {
  const restores = [];
  const replace = (target, key, value) => {
    const previous = target[key];
    restores.push(() => { target[key] = previous; });
    target[key] = value;
    return previous;
  };
  const recover = async () => Promise.all(await recover_shipments());
  const fails = async (work, text) => {
    let error;
    try { await work(); }
    catch (caught) { error = caught; }
    expect(error && error.message).to.include(text);
  };
  let effects;

  beforeEach(async () => {
    await resetDatabase();
    effects = 0;
    replace(console, 'error', () => {});
    replace(H, 'harbors', { test: { work: (lane, manifest) => {
      effects++;
      return manifest;
    } } });
    await Lanes.insertAsync({ _id: 'parent', type: 'test',
      followup: { _id: 'child' } });
    await Lanes.insertAsync({ _id: 'child', type: 'test' });
    await Harbors.insertAsync({ _id: 'test', lanes: {
      child: { manifest: { setting: 'original' } },
    } });
    await Shipments.insertAsync({ _id: 'parent-work', lane: 'parent',
      active: true, actual: new Date(), stdout: {}, stderr: {},
      manifest: { shipment_id: 'parent-work' },
    });
  });
  afterEach(() => {
    while (restores.length) restores.pop()();
  });

  it('holds uncertain work instead of replaying an external effect',
    async () => {
      const upsert = replace(ShipmentReturns, 'upsertAsync', async () => {
        throw new Error('checkpoint unavailable');
      });
      await fails(() => start_shipment('child', {}, 'planned', 'uncertain'),
        'checkpoint unavailable');
      ShipmentReturns.upsertAsync = upsert;
      await recover();
      await recover();
      const saved = await Shipments.findOneAsync('uncertain');
      expect(effects).to.eq(1);
      expect(saved.active).to.eq(true);
      expect(saved.dispatch.started).to.be.instanceOf(Date);
      expect(saved.dispatch.pending).to.eq(false);
      expect(saved.dispatch.error).to.include('unknown');
      expect(Object.values(saved.stderr).join(' ')).to.include('unknown');
      await end_shipment({ _id: 'child' }, 0,
        { shipment_id: 'uncertain', result: 'late callback' });
      expect((await Shipments.findOneAsync('uncertain')).active).to.eq(false);
    });

  it('replays only a harbor that explicitly declares safe replay', async () => {
    H.harbors.test.replay_safe = true;
    await Shipments.insertAsync({ _id: 'safe', lane: 'child', active: true,
      actual: new Date(), manifest: { shipment_id: 'safe' },
      dispatch: { pending: true, started: new Date() },
    });
    await recover();
    expect(effects).to.eq(1);
    expect((await Shipments.findOneAsync('safe')).dispatch.pending)
      .to.eq(undefined);
  });

  it('can retry when work was never marked started', async () => {
    const update = Shipments.updateAsync;
    replace(Shipments, 'updateAsync', async (...args) => {
      if (args[1].$set && args[1].$set['dispatch.started']) {
        throw new Error('start unavailable');
      }
      return update.apply(Shipments, args);
    });
    await fails(() => start_shipment('child', {}, 'planned', 'not-started'),
      'start unavailable');
    expect(effects).to.eq(0);
    Shipments.updateAsync = update;
    await recover();
    expect(effects).to.eq(1);
  });

  it('fences the write that authorizes work to start', async () => {
    const update = Shipments.updateAsync;
    replace(Shipments, 'updateAsync', async (...args) => {
      if (args[1].$set && args[1].$set['dispatch.started']) {
        await update.call(Shipments, 'lost-start', {
          $set: { 'dispatch.token': 'replacement' },
        });
      }
      return update.apply(Shipments, args);
    });
    await fails(() => start_shipment('child', {}, 'planned', 'lost-start'),
      'pending');
    expect(effects).to.eq(0);
    expect((await Shipments.findOneAsync('lost-start')).dispatch.token)
      .to.eq('replacement');
  });

  it('holds a lost start acknowledgment even when work may not have run',
    async () => {
      const update = Shipments.updateAsync;
      replace(Shipments, 'updateAsync', async (...args) => {
        const result = await update.apply(Shipments, args);
        if (args[1].$set && args[1].$set['dispatch.started']) {
          throw new Error('start acknowledgment lost');
        }
        return result;
      });
      await fails(() => start_shipment('child', {}, 'planned', 'lost-ack'),
        'acknowledgment lost');
      Shipments.updateAsync = update;
      await recover();
      expect(effects).to.eq(0);
      expect((await Shipments.findOneAsync('lost-ack')).dispatch.pending)
        .to.eq(false);
    });

  it('does not hold work after losing ownership of its dispatch', async () => {
    await Shipments.insertAsync({ _id: 'lost-hold', lane: 'child', active: true,
      actual: new Date(), manifest: {}, stderr: {},
      dispatch: { pending: true, started: new Date() },
    });
    const update = Shipments.updateAsync;
    replace(Shipments, 'updateAsync', async (...args) => {
      if (args[1].$set && args[1].$set['dispatch.pending'] === false) {
        await update.call(Shipments, 'lost-hold', {
          $set: { 'dispatch.token': 'replacement' },
        });
      }
      return update.apply(Shipments, args);
    });
    await recover();
    const saved = await Shipments.findOneAsync('lost-hold');
    expect(saved.dispatch.pending).to.eq(true);
    expect(saved.dispatch.error).to.eq(undefined);
    expect(saved.stderr).to.deep.eq({});
    expect(effects).to.eq(0);
  });

  it('does not use a claim that was lost before reading its shipment',
    async () => {
      await Shipments.updateAsync('parent-work', {
        $set: { dispatch: { pending: true } },
      });
      const find = Shipments.findOneAsync;
      replace(Shipments, 'findOneAsync', async (...args) => {
        if (args[0]['dispatch.token']) {
          await Shipments.updateAsync('parent-work', {
            $set: { 'dispatch.token': 'replacement' },
          });
        }
        return find.apply(Shipments, args);
      });
      await claim_shipment('parent-work', 'dispatch', () => { effects++; });
      expect(effects).to.eq(0);
      expect((await Shipments.findOneAsync('parent-work')).dispatch.token)
        .to.eq('replacement');
    });

  it('does not hold a shipment completed by a late callback', async () => {
    await Shipments.insertAsync({ _id: 'late', lane: 'child', active: true,
      actual: new Date(), manifest: {}, stderr: {},
      dispatch: { pending: true, started: new Date() },
    });
    const update = Shipments.updateAsync;
    replace(Shipments, 'updateAsync', async (...args) => {
      if (args[1].$set && args[1].$set['dispatch.pending'] === false) {
        await update.call(Shipments, 'late', { $set: { active: false } });
      }
      return update.apply(Shipments, args);
    });
    await recover();
    const saved = await Shipments.findOneAsync('late');
    expect(saved.active).to.eq(false);
    expect(saved.dispatch.error).to.eq(undefined);
    expect(saved.stderr).to.deep.eq({});
    await recover();
    expect((await Shipments.findOneAsync('late')).dispatch.pending)
      .to.eq(undefined);
    expect(effects).to.eq(0);
  });

  it('keeps independent recovery moving while another work promise waits',
    async () => {
      let release;
      let started;
      let independent;
      let timeout;
      const slow = new Promise(resolve => { started = resolve; });
      const fast = new Promise(resolve => { independent = resolve; });
      H.harbors.test.work = async (lane, manifest) => {
        effects++;
        if (manifest.shipment_id == 'slow') {
          started();
          await new Promise(resolve => { release = resolve; });
        }
        else independent();
        return manifest;
      };
      for (const _id of ['slow', 'independent']) {
        await Shipments.insertAsync({ _id, lane: 'child', active: true,
          actual: new Date(), manifest: { shipment_id: _id },
          dispatch: { pending: true },
        });
      }
      const scanning = recover_shipments();
      await slow;
      try {
        await Promise.race([fast, new Promise((resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('recovery blocked')),
            1000);
        })]);
        const tasks = await scanning;
        const owner = (await Shipments.findOneAsync('slow')).dispatch.token;
        const repeated = await recover_shipments();
        expect(repeated).to.have.length(tasks.length);
        expect((await Shipments.findOneAsync('slow')).dispatch.token)
          .to.eq(owner);
        expect(effects).to.eq(2);
      }
      finally {
        clearTimeout(timeout);
        release();
        await Promise.all(await scanning);
      }
    });

  it('saves a finished parent before resolving a missing continuation',
    async () => {
      await Lanes.updateAsync('parent', {
        $set: { followup: { _id: 'missing', last_shipment: 'omit' } },
      });
      await fails(() => end_shipment({ _id: 'parent' }, 0,
        { shipment_id: 'parent-work', result: 'done' }), 'not found');
      const saved = await Shipments.findOneAsync('parent-work');
      expect(saved.active).to.eq(false);
      expect(saved.finished).to.be.instanceOf(Date);
      expect(saved.manifest.result).to.eq('done');
      expect(saved.completion.pending).to.eq(true);
      expect(saved.completion.error).to.include('not found');
      expect(saved.completion.next.reference).to.deep.eq({ _id: 'missing' });
      expect((await LatestShipment.findOneAsync('parent')).shipment.active)
        .to.eq(false);
      await Lanes.insertAsync({ _id: 'missing', type: 'test' });
      await Harbors.updateAsync('test', {
        $set: { 'lanes.missing.manifest': { repaired: true } },
      });
      // Later routing edits must not redirect an already completed parent.
      await Lanes.updateAsync('parent', {
        $set: { followup: { _id: 'child' } },
      });
      await recover();
      const child = await Shipments.findOneAsync(saved.completion.next
        .shipment_id);
      expect(child.lane).to.eq('missing');
      expect(child.manifest.repaired).to.eq(true);
      expect(child.manifest.prior_manifest.result).to.eq('done');
      expect((await Shipments.findOneAsync('parent-work')).completion.pending)
        .to.eq(undefined);
      expect(effects).to.eq(1);
    });

  it('checkpoints resolved settings before starting a child', async () => {
    const update = Shipments.updateAsync;
    replace(Shipments, 'updateAsync', async (...args) => {
      const result = await update.apply(Shipments, args);
      if (args[1].$set && args[1].$set['completion.next']) {
        throw new Error('resolution acknowledgment lost');
      }
      return result;
    });
    await fails(() => end_shipment({ _id: 'parent' }, 0,
      { shipment_id: 'parent-work' }), 'acknowledgment lost');
    expect(effects).to.eq(0);
    await Harbors.updateAsync('test', {
      $set: { 'lanes.child.manifest': { setting: 'changed' } },
    });
    Shipments.updateAsync = update;
    await recover();
    const child = await Shipments.findOneAsync({ lane: 'child' });
    expect(child.manifest.setting).to.eq('original');
    expect(effects).to.eq(1);
  });

  it('does not start a child after losing the continuation claim', async () => {
    const update = Shipments.updateAsync;
    replace(Shipments, 'updateAsync', async (...args) => {
      if (args[1].$set && args[1].$set['completion.next']) {
        await update.call(Shipments, 'parent-work', {
          $set: { 'completion.token': 'replacement' },
        });
      }
      return update.apply(Shipments, args);
    });
    await fails(() => end_shipment({ _id: 'parent' }, 0,
      { shipment_id: 'parent-work' }), 'pending');
    expect(effects).to.eq(0);
    const child = await Shipments.findOneAsync({ lane: 'child' });
    expect(child.dispatch.pending).to.eq(false);
    expect(child.dispatch.started).to.eq(undefined);
    expect((await Shipments.findOneAsync('parent-work')).completion.pending)
      .to.eq(true);
    Shipments.updateAsync = update;
    await Shipments.updateAsync('parent-work', {
      $set: { 'completion.until': new Date(0) },
    });
    await recover();
    expect(effects).to.eq(1);
  });

  it('reuses a child after the final completion write fails', async () => {
    const update = Shipments.updateAsync;
    replace(Shipments, 'updateAsync', async (...args) => {
      if (args[1].$set && args[1].$set.completion &&
        !args[1].$set.completion.pending) {
        throw new Error('completion unavailable');
      }
      return update.apply(Shipments, args);
    });
    await fails(() => end_shipment({ _id: 'parent' }, 0,
      { shipment_id: 'parent-work' }), 'completion unavailable');
    expect(effects).to.eq(1);
    Shipments.updateAsync = update;
    await recover();
    expect(effects).to.eq(1);
    expect(await Shipments.find({ lane: 'child' }).countAsync()).to.eq(1);
    expect((await Shipments.findOneAsync('parent-work')).completion.pending)
      .to.eq(undefined);
  });
});
