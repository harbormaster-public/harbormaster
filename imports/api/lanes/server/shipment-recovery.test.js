import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { patches, rejects as reject } from '../../../test-helpers/async';
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
  const { replace, restore_all } = patches();
  const retry_timers = () => {
    const pending = [];
    const timeout = globalThis.setTimeout;
    const clear = globalThis.clearTimeout;
    replace(globalThis, 'setTimeout', (callback, delay) => {
      if (callback.name != 'run') return timeout(callback, delay);
      const timer = { callback, delay };
      pending.push(timer);
      return timer;
    });
    replace(globalThis, 'clearTimeout', timer => {
      const index = pending.indexOf(timer);
      if (index == -1) return clear(timer);
      pending.splice(index, 1);
      return undefined;
    });
    return pending;
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
  afterEach(restore_all);

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

  it('starts a downstream shipment after history is repaired', async () => {
    const upsert = LatestShipment.upsertAsync;
    replace(LatestShipment, 'upsertAsync', async (...args) => {
      if (args[0]._id == 'parent') throw new Error('history unavailable');
      return upsert.apply(LatestShipment, args);
    });
    await reject(() => finish(), 'history unavailable');
    expect(calls).to.eq(0);
    LatestShipment.upsertAsync = upsert;
    await Promise.all(await recover_shipments());
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
    await Promise.all(await recover_shipments());
    await Promise.all(await recover_shipments());
    expect(calls).to.eq(1);
    expect((await Shipments.findOneAsync(child._id)).dispatch.pending)
      .to.eq(undefined);
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
    await Promise.all(await recover_shipments());
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

  it('persists input and checkpoints the returned state', async () => {
    H.harbors.test.work = async (lane, manifest, shipment) => {
      const saved = await Shipments.findOneAsync(shipment._id);
      expect(saved.manifest).to.deep.eq(manifest);
      expect(saved.actual).to.deep.eq(shipment.actual);
      manifest.nested.value = 'mutated';
      return manifest;
    };
    await start_shipment('child', { nested: { value: 'original' } }, 'planned');
    const saved = await Shipments.findOneAsync({ lane: 'child' });
    expect(saved.manifest.nested.value).to.eq('mutated');
  });

  it('retries an ambiguous creation using the same shipment identity',
    async () => {
      H.harbors.test.work = (lane, manifest) => { calls++; return manifest; };
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
    await Promise.all(await recover_shipments());
    expect(calls).to.eq(1);
    expect((await Shipments.findOneAsync('saved-work')).dispatch.pending)
      .to.eq(undefined);
  });

  it('does not run pending work after a reset', async () => {
    await Shipments.updateAsync('source', {
      $set: { active: false, dispatch: { pending: true } },
    });
    await Promise.all(await recover_shipments());
    expect(calls).to.eq(0);
    expect((await Shipments.findOneAsync('source')).dispatch.pending)
      .to.eq(undefined);
  });

  it('discards a result after another worker takes over dispatch', async () => {
    H.harbors.test.work = async (lane, manifest, shipment) => {
      await Shipments.updateAsync(shipment._id, { $set: {
        'dispatch.token': 'replacement',
        'dispatch.until': new Date(Date.now() + 60000),
      } });
      return { ...manifest, error: 'expired worker' };
    };
    await reject(() => start_shipment('child', {}, 'planned',
      'lost-claim'), 'pending');
    const saved = await Shipments.findOneAsync('lost-claim');
    expect(saved.active).to.eq(true);
    expect(saved.exit_code).to.eq(undefined);
    expect(saved.dispatch.token).to.eq('replacement');
    expect(saved.dispatch.returned).to.eq(undefined);
    expect(saved.completion).to.eq(undefined);
    expect(saved.stderr).to.deep.eq({});
  });

  it('fences error completion after losing ownership', async () => {
    H.harbors.test.work = (lane, manifest) => ({
      ...manifest, error: 'failed',
    });
    const update = Shipments.updateAsync;
    replace(Shipments, 'updateAsync', async (...args) => {
      const result = await update.apply(Shipments, args);
      if (args[1].$set && args[1].$set['dispatch.returned']) {
        await update.call(Shipments, 'lost-after-save', { $set: {
          'dispatch.token': 'replacement',
        } });
      }
      return result;
    });
    await reject(() => start_shipment('child', {}, 'planned',
      'lost-after-save'), 'pending');
    const saved = await Shipments.findOneAsync('lost-after-save');
    expect(saved.active).to.eq(true);
    expect(saved.completion).to.eq(undefined);
    expect(saved.dispatch.token).to.eq('replacement');
  });

  it('checks ownership in the atomic completion update', async () => {
    H.harbors.test.work = (lane, manifest) => ({
      ...manifest, error: 'failed',
    });
    const update = Shipments.updateAsync;
    replace(Shipments, 'updateAsync', async (...args) => {
      if (args[1].$set && args[1].$set.active === false) {
        await update.call(Shipments, 'lost-before-completion', { $set: {
          'dispatch.token': 'replacement',
        } });
      }
      return update.apply(Shipments, args);
    });
    await reject(() => start_shipment('child', {}, 'planned',
      'lost-before-completion'), 'pending');
    const saved = await Shipments.findOneAsync('lost-before-completion');
    expect(saved.active).to.eq(true);
    expect(saved.completion).to.eq(undefined);
  });

  it('checkpoints and completes a manifest larger than half the BSON limit',
    async () => {
      H.harbors.test.work = (lane, manifest) => manifest;
      const payload = 'x'.repeat(9 * 1024 * 1024);
      await start_shipment('child', { payload }, 'planned', 'large-input');
      const saved = await Shipments.findOneAsync('large-input');
      expect(saved.manifest.payload.length).to.eq(payload.length);
      expect(saved.dispatch.pending).to.eq(undefined);
      await end_shipment({ _id: 'child' }, 0,
        { shipment_id: saved._id, payload });
      expect((await Shipments.findOneAsync(saved._id)).active).to.eq(false);
      expect((await LatestShipment.findOneAsync('child')).shipment.active)
        .to.eq(false);
    });

  it('returns downstream results and attaches the parent output', async () => {
    H.harbors.test.work = () => ({ child_result: true });
    await Shipments.updateAsync('source', { $set: {
      stdout: { output: 'parent output' }, stderr: { warning: 'parent error' },
    } });
    const manifest = { shipment_id: 'source' };
    const result = await end_shipment({ _id: 'parent' }, 0, manifest);
    expect(result.child_result).to.eq(true);
    expect(manifest.stdout).to.deep.eq({ output: 'parent output' });
    expect(manifest.stderr).to.deep.eq({ warning: 'parent error' });
  });

  it('returns the updated manifest for terminal completions', async () => {
    await Lanes.updateAsync('parent', { $unset: { followup: '' } });
    await Shipments.updateAsync('source', { $set: {
      stdout: { output: 'terminal output' },
    } });
    const manifest = { shipment_id: 'source', result: 'done' };
    const result = await end_shipment({ _id: 'parent' }, 0, manifest);
    expect(result.result).to.eq('done');
    expect(result.stdout).to.deep.eq({ output: 'terminal output' });
  });

  it('returns salvage results after work fails', async () => {
    await Lanes.updateAsync('parent', {
      $set: { salvage_plan: { _id: 'child' } },
    });
    H.harbors.test.work = (lane, manifest) => lane._id == 'parent' ?
      { ...manifest, error: 'failed' } : { salvaged: true };
    const result = await start_shipment('parent', {}, 'planned', 'failed-work');
    expect(result).to.deep.eq({ salvaged: true });
    expect((await Shipments.findOneAsync('failed-work')).active).to.eq(false);
  });

  it('preserves an undefined downstream return value', async () => {
    H.harbors.test.work = () => undefined;
    expect(await finish()).to.eq(undefined);
    expect((await Shipments.findOneAsync('source')).completion.pending)
      .to.eq(undefined);
  });

  it('does not overwrite results completed inside work', async () => {
    H.harbors.test.work = (lane, manifest) => H.call(
      'Lanes#end_shipment', lane, 0, { ...manifest, result: 'completed' },
    );
    const result = await start_shipment('child', {}, 'planned', 'synchronous');
    const saved = await Shipments.findOneAsync('synchronous');
    expect(result.result).to.eq('completed');
    expect(saved.manifest.result).to.eq('completed');
    expect(saved.dispatch.pending).to.eq(undefined);
    expect(saved.active).to.eq(false);
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
      await Promise.all(await recover_shipments());
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
    await Promise.all(await recover_shipments());
    expect((await Shipments.findOneAsync('source')).dispatch.pending)
      .to.eq(false);
    await reject(() => end_shipment({ _id: 'parent' }, 0,
      { shipment_id: 'source' }), 'another lane');
    await reject(() => start_shipment(
      'child', {}, 'planned', 'source',
    ),
    'another lane');
    await Shipments.updateAsync('source', { $set: { lane: 'parent' } });
    await Lanes.removeAsync('parent');
    await finish();
    expect((await Shipments.findOneAsync('source')).active).to.eq(false);
    expect(await Lanes.findOneAsync('parent')).to.eq(undefined);
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
        if (fail && args[0].shipment_history) {
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

  it('renews at lease deadlines and backs off after failures', async () => {
    const pending = retry_timers();
    replace(console, 'error', () => {});
    await Shipments.updateAsync('source', {
      $set: { dispatch: { pending: true } },
    });
    await claim_shipment('source', 'dispatch', async () => {
      expect(pending[0].delay).to.be.within(29000, 45000);
      await pending.shift().callback();
      const update = Shipments.updateAsync;
      try {
        Shipments.updateAsync = async () => {
          throw new Error('renewal failed');
        };
        await pending.shift().callback();
        expect(pending[0].delay).to.be.within(500, 1000);
      }
      finally { Shipments.updateAsync = update; }
      await pending.shift().callback();
      await update.call(Shipments, 'source', {
        $set: { 'dispatch.token': 'replacement' },
      });
      await pending.shift().callback();
      expect(pending).to.have.length(0);
    });
  });

  it('uses the saved lease deadline after a delayed claim acknowledgment',
    async () => {
      const pending = retry_timers();
      let now = Date.now();
      replace(Date, 'now', () => now);
      const update = replace(Shipments, 'updateAsync', async (...args) => {
        const saved = await update.apply(Shipments, args);
        if (args[1].$set?.['dispatch.token']) now += 45000;
        return saved;
      });
      await Shipments.updateAsync('source', {
        $set: { dispatch: { pending: true } },
      });
      await claim_shipment('source', 'dispatch', async () => {
        expect(pending[0].delay).to.be.within(7500, 11250);
      });
      expect(pending).to.have.length(0);
    });

  it('retries failed completion without rescanning healthy shipments',
    async () => {
      const pending = retry_timers();
      replace(console, 'error', () => {});
      const upsert = replace(LatestShipment, 'upsertAsync', async () => {
        throw new Error('history unavailable');
      });
      await reject(() => finish(), 'history unavailable');
      expect(pending).to.have.length(1);
      expect(pending[0].delay).to.be.within(500, 1000);
      await pending.shift().callback();
      expect(pending[0].delay).to.be.within(1000, 2000);
      LatestShipment.upsertAsync = upsert;
      await pending.shift().callback();
      expect(pending).to.have.length(0);
      expect((await Shipments.findOneAsync('source')).completion.pending)
        .to.eq(undefined);
      expect(calls).to.eq(1);
    });

  it('checks a remote claim at its current expiry and recovers when free',
    async () => {
      const pending = retry_timers();
      await Shipments.updateAsync('source', { $set: { dispatch: {
        pending: true, token: 'remote', until: new Date(Date.now() + 5000),
      } } });
      await Promise.all(await recover_shipments());
      expect(pending).to.have.length(1);
      expect(pending[0].delay).to.be.within(4000, 5000);
      await Shipments.updateAsync('source', { $set: {
        'dispatch.until': new Date(Date.now() + 20000),
      } });
      await pending.shift().callback();
      expect(pending[0].delay).to.be.within(19000, 20000);
      await Shipments.updateAsync('source', {
        $set: { 'dispatch.until': new Date(0) },
      });
      await pending.shift().callback();
      expect(pending).to.have.length(0);
      expect(calls).to.eq(1);
    });

  it('drops a queued retry after a pending shipment is deleted', async () => {
    const pending = retry_timers();
    replace(console, 'error', () => {});
    const upsert = replace(Shipments, 'upsertAsync', async (...args) => {
      const saved = await upsert.apply(Shipments, args);
      throw new Error(`lost acknowledgment: ${saved.numberAffected}`);
    });
    await reject(() => start_shipment('child', {}, 'planned', 'deleted'),
      'lost acknowledgment');
    Shipments.upsertAsync = upsert;
    await Shipments.removeAsync('deleted');
    await pending.shift().callback();
    expect(pending).to.have.length(0);
    expect(calls).to.eq(0);
  });
});
