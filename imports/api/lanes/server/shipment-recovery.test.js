import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Lanes } from '..';
import { Shipments, LatestShipment } from '../../shipments';
import {
  start_shipment, end_shipment, recover_shipments,
} from './methods';
import {
  claim_shipment, prepare_shipment_totals,
  update_shipment_totals, update_shipment_history,
} from './shipment-state';
import { Harbors } from '../../harbors';

describe('Shipment recovery', () => {
  const restores = [];
  const replace = (target, key, value) => {
    const previous = target[key];
    restores.push(() => { target[key] = previous; });
    target[key] = value;
    return previous;
  };
  const reject = async (work, message) => {
    let error;
    try { await work(); }
    catch (caught) { error = caught; }
    expect(error && error.message).to.include(message);
  };
  const finish = (exit_code = 0, result = 'original') => end_shipment(
    { _id: 'parent' }, exit_code, { shipment_id: 'source', result },
  );
  let calls;

  beforeEach(async () => {
    await resetDatabase();
    calls = 0;
    replace(H, 'harbors', {
      test: { work: () => { calls++; return { success: true }; } },
    });
    await Lanes.insertAsync({
      _id: 'parent', type: 'test', name: 'Parent', shipment_count: 100,
      salvage_runs: 7, followup: { _id: 'child' },
    });
    await Lanes.insertAsync({ _id: 'child', type: 'test' });
    await Harbors.insertAsync({ _id: 'test', lanes: {
      child: { manifest: { original: true } },
    } });
    await Shipments.insertAsync({
      _id: 'source', lane: 'parent', active: true,
      actual: new Date(Date.now() - 5000), stdout: {}, stderr: {},
      manifest: { shipment_id: 'source' },
    });
  });
  afterEach(() => {
    while (restores.length) restores.pop()();
  });

  it('retries finalization after the result has become inactive', async () => {
    const update = Lanes.updateAsync;
    replace(Lanes, 'updateAsync', async (...args) => {
      if (args[1].$max) throw new Error('temporary database failure');
      return update.apply(Lanes, args);
    });
    await reject(() => finish(), 'temporary database failure');
    const pending = await Shipments.findOneAsync('source');
    expect(pending.active).to.eq(false);
    expect(pending.completion.pending).to.eq(true);
    Lanes.updateAsync = update;
    await finish(1, 'duplicate');
    const settled = await Shipments.findOneAsync('source');
    expect(settled.manifest.result).to.eq('original');
    expect(settled.exit_code).to.eq(0);
    expect(settled.completion.pending).to.eq(undefined);
    expect(await Shipments.find({ lane: 'child' }).countAsync()).to.eq(1);
    expect(calls).to.eq(1);
  });

  it('reuses a downstream shipment after history fails', async () => {
    const upsert = LatestShipment.upsertAsync;
    replace(LatestShipment, 'upsertAsync', async (...args) => {
      if (args[0]._id == 'parent') throw new Error('history unavailable');
      return upsert.apply(LatestShipment, args);
    });
    await reject(() => finish(), 'history unavailable');
    expect(calls).to.eq(1);
    LatestShipment.upsertAsync = upsert;
    await recover_shipments();
    expect(calls).to.eq(1);
    expect(await Shipments.find({ lane: 'child' }).countAsync()).to.eq(1);
    expect((await Shipments.findOneAsync('source')).completion.pending)
      .to.eq(undefined);
  });

  it('recovers a child created before its harbor is available', async () => {
    replace(H, 'harbors', {});
    await reject(() => finish(), 'Harbor is not ready');
    const child = await Shipments.findOneAsync({ lane: 'child' });
    expect(child.active).to.eq(true);
    expect(child.exit_code).to.eq(undefined);
    expect(child.manifest.original).to.eq(true);
    expect(child.dispatch.pending).to.eq(true);
    H.harbors.test = { work: () => { calls++; return {}; } };
    await recover_shipments();
    expect(calls).to.eq(1);
    expect((await Shipments.findOneAsync(child._id)).dispatch).to.eq(undefined);
    expect((await Shipments.findOneAsync('source')).completion.pending)
      .to.eq(undefined);
  });

  it('counts distinct failed completions that collide', async () => {
    await Lanes.updateAsync('parent', {
      $set: { salvage_plan: { _id: 'child' } },
    });
    await Shipments.insertAsync({
      _id: 'second', lane: 'parent', active: true, actual: new Date(),
    });
    await Promise.all([
      finish(1),
      end_shipment({ _id: 'parent' }, 1, { shipment_id: 'second' }),
    ]);
    await recover_shipments();
    expect((await Lanes.findOneAsync('parent')).salvage_runs).to.eq(9);
    expect(await Shipments.find({ lane: 'child' }).countAsync()).to.eq(2);
    await finish(1);
    expect((await Lanes.findOneAsync('parent')).salvage_runs).to.eq(9);
  });

  it('does not replay a completed claim after its acknowledgment is lost',
    async () => {
      const update = Shipments.updateAsync;
      let fail = true;
      replace(Shipments, 'updateAsync', async (...args) => {
        const result = await update.apply(Shipments, args);
        if (fail && args[1].$set && args[1].$set.completion &&
          !args[1].$set.completion.pending) {
          fail = false;
          throw new Error('acknowledgment lost');
        }
        return result;
      });
      await reject(() => finish(), 'acknowledgment lost');
      await finish();
      expect(calls).to.eq(1);
      expect(await Shipments.find({ lane: 'child' }).countAsync()).to.eq(1);
    });

  it('persists original input before work can mutate it', async () => {
    H.harbors.test.work = async (lane, manifest, shipment) => {
      const saved = await Shipments.findOneAsync(shipment._id);
      expect(saved.manifest).to.deep.eq(manifest);
      expect(saved.actual).to.deep.eq(shipment.actual);
      manifest.nested.value = 'mutated';
      return manifest;
    };
    await start_shipment('child', { nested: { value: 'original' } }, 'planned');
    const saved = await Shipments.findOneAsync({ lane: 'child' });
    expect(saved.manifest.nested.value).to.eq('original');
  });

  it('retries an ambiguous creation using the same shipment identity',
    async () => {
      const upsert = Shipments.upsertAsync;
      let fail = true;
      replace(Shipments, 'upsertAsync', async (...args) => {
        const result = await upsert.apply(Shipments, args);
        if (fail) { fail = false; throw new Error('insert response lost'); }
        return result;
      });
      await reject(() => start_shipment('child', { original: true },
        'planned', 'stable-child'), 'insert response lost');
      const original = await Shipments.findOneAsync('stable-child');
      expect(calls).to.eq(0);
      await start_shipment('child', { original: false },
        'later', 'stable-child');
      const saved = await Shipments.findOneAsync('stable-child');
      expect(saved.actual).to.deep.eq(original.actual);
      expect(saved.manifest.original).to.eq(true);
      expect(await Shipments.find({ lane: 'child' }).countAsync()).to.eq(1);
      expect(calls).to.eq(1);
    });

  it('retains the work result while repairing history', async () => {
    const update = Shipments.updateAsync;
    replace(Shipments, 'updateAsync', async (...args) => {
      const result = await update.apply(Shipments, args);
      if (args[1].$set && args[1].$set['dispatch.returned']) {
        throw new Error('work response lost');
      }
      return result;
    });
    await reject(() => start_shipment('child', {}, 'planned', 'saved-work'),
      'work response lost');
    expect(calls).to.eq(1);
    Shipments.updateAsync = update;
    await recover_shipments();
    expect(calls).to.eq(1);
    expect((await Shipments.findOneAsync('saved-work')).dispatch)
      .to.eq(undefined);
  });

  it('does not run pending work after a reset', async () => {
    await Shipments.updateAsync('source', {
      $set: { active: false, dispatch: { pending: true } },
    });
    await recover_shipments();
    expect(calls).to.eq(0);
    expect((await Shipments.findOneAsync('source')).dispatch).to.eq(undefined);
  });

  it('preserves a returned error through a lost work acknowledgment',
    async () => {
      H.harbors.test.work = (lane, manifest) => {
        calls++;
        return { ...manifest, error: new Error('returned failure') };
      };
      const update = Shipments.updateAsync;
      replace(Shipments, 'updateAsync', async (...args) => {
        const result = await update.apply(Shipments, args);
        if (args[1].$set && args[1].$set['dispatch.returned']) {
          throw new Error('work response lost');
        }
        return result;
      });
      await reject(() => start_shipment('child', {}, 'planned', 'error-work'),
        'work response lost');
      Shipments.updateAsync = update;
      await recover_shipments();
      const saved = await Shipments.findOneAsync('error-work');
      expect(saved.exit_code).to.eq(1);
      expect(saved.manifest.error).to.eq('Error: returned failure');
      expect(Object.keys(saved.stderr)[0]).to.match(/GMT/);
      expect(Object.values(saved.stderr)).to.include('Error: returned failure');
      expect(calls).to.eq(1);
    });

  it('reports recovery failures and continues', async () => {
    replace(console, 'error', () => {});
    await Shipments.updateAsync('source', {
      $set: { lane: 'missing', dispatch: { pending: true } },
    });
    await recover_shipments();
    expect((await Shipments.findOneAsync('source')).dispatch.pending)
      .to.eq(true);
    await reject(() => end_shipment({ _id: 'parent' }, 0,
      { shipment_id: 'source' }), 'another lane');
    await reject(() => start_shipment(
      'child', {}, 'planned', 'source',
    ),
    'another lane');
    await Shipments.updateAsync('source', { $set: { lane: 'parent' } });
    await Lanes.removeAsync('parent');
    await reject(() => finish(), 'Lane not found');
  });

  it('keeps newer history when an older shipment completes', async () => {
    await start_shipment('parent', {}, 'newer', 'newer');
    await finish();
    expect((await Lanes.findOneAsync('parent')).last_shipment._id)
      .to.eq('newer');
    expect((await LatestShipment.findOneAsync('parent')).shipment._id)
      .to.eq('newer');
  });

  it('retries history when another writer changes the lane snapshot',
    async () => {
      const update = Lanes.updateAsync;
      let fail = true;
      replace(Lanes, 'updateAsync', async (...args) => {
        if (fail && args[0].last_shipment) {
          fail = false;
          return 0;
        }
        return update.apply(Lanes, args);
      });
      await update_shipment_history('parent');
      expect(fail).to.eq(false);
    });

  it('retries history when a concurrent upsert wins', async () => {
    const upsert = LatestShipment.upsertAsync;
    let fail = true;
    replace(LatestShipment, 'upsertAsync', async (...args) => {
      if (fail) {
        fail = false;
        const error = new Error('duplicate');
        error.code = 11000;
        throw error;
      }
      return upsert.apply(LatestShipment, args);
    });
    await update_shipment_history('parent');
    expect((await LatestShipment.findOneAsync('parent')).shipment._id)
      .to.eq('source');
  });

  it('preserves legacy totals and reports missing lanes', async () => {
    await update_shipment_totals('parent');
    expect((await Lanes.findOneAsync('parent')).shipment_count).to.eq(100);
    await reject(() => prepare_shipment_totals('missing'), 'Lane not found');
    await reject(() => update_shipment_history('missing'), 'Lane not found');
    await Lanes.updateAsync('parent', { $unset: { shipment_totals: '',
      shipment_count: '', salvage_runs: '' } });
    expect(await prepare_shipment_totals('parent'))
      .to.deep.eq({ shipments: 0, salvage: 0 });
  });

  it('takes over expired claims without clearing another owner', async () => {
    await Shipments.updateAsync('source', { $set: { dispatch: {
      pending: true, token: 'dead-server', until: new Date(0),
    } } });
    await claim_shipment('source', 'dispatch', async () => {
      await Shipments.updateAsync('source', {
        $set: { 'dispatch.token': 'new-owner' },
      });
    });
    expect((await Shipments.findOneAsync('source')).dispatch.token)
      .to.eq('new-owner');
  });

  it('renews long work claims and reports renewal failures', async () => {
    let tick;
    replace(globalThis, 'setInterval', callback => {
      tick = callback; return 0;
    });
    replace(console, 'error', () => {});
    await Shipments.updateAsync('source', {
      $set: { dispatch: { pending: true } },
    });
    await claim_shipment('source', 'dispatch', async () => {
      tick();
      await new Promise(resolve => setImmediate(resolve));
      const update = Shipments.updateAsync;
      Shipments.updateAsync = async () => {
        throw new Error('renewal failed');
      };
      tick();
      await new Promise(resolve => setImmediate(resolve));
      Shipments.updateAsync = update;
    });
  });
});
