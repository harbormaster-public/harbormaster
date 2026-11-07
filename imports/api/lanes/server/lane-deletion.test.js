import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { patches, gate } from '../../../test-helpers/async';
import { Lanes } from '..';
import { Shipments } from '../../shipments';
import { Harbors } from '../../harbors';
import {
  delete_lane, start_shipment, reset_shipment, recover_shipments,
  end_shipment,
} from './methods';

const fails = async (work, code) => {
  let error;
  try { await work(); }
  catch (caught) { error = caught; }
  expect(error?.error).to.eq(code);
  return error;
};

describe('Idle lane deletion', () => {
  const { replace, restore_all } = patches();
  const start = () => start_shipment('lane', {}, 'planned', 'source');
  const remove = () => delete_lane({ _id: 'lane', type: 'wrong' });
  let effects;

  beforeEach(async () => {
    await resetDatabase();
    effects = 0;
    replace(console, 'error', () => {});
    replace(H, 'harbors', { test: { work: (lane, manifest) => {
      effects++;
      return manifest;
    } } });
    await Lanes.insertAsync({ _id: 'lane', slug: 'lane', type: 'test' });
    await Harbors.insertAsync({ _id: 'test', lanes: {
      lane: { manifest: {} }, other: { manifest: {} },
    } });
  });
  afterEach(restore_all);

  ['start', 'completion'].forEach(caller => {
    it(`rejects an overlapping ${caller} when deletion cancels its dispatch`,
      async () => {
        const deletion = gate();
        const admission = gate();
        const claim = gate();
        const remove_lane = replace(Lanes, 'removeAsync', async (...args) => {
          await deletion.wait();
          return remove_lane.apply(Lanes, args);
        });
        const update = replace(Lanes, 'updateAsync', async (...args) => {
          if (args[0]._id == 'lane' && args[0].shipment_history) {
            await admission.wait();
          }
          return update.apply(Lanes, args);
        });
        if (caller == 'completion') {
          await Lanes.insertAsync({ _id: 'parent', type: 'test' });
          await Shipments.insertAsync({
            _id: 'parent-source', lane: 'parent', active: false,
            actual: new Date(), manifest: { shipment_id: 'parent-source' },
            stdout: {}, stderr: {},
            completion: { pending: true, failed: false, next: {
              lane: 'lane', shipment_id: 'source', start: 'planned',
            } },
          });
        }
        const deleting = remove();
        let first;
        let second;
        try {
          await deletion.reached;
          first = start().catch(error => error);
          await admission.reached;
          const shipment_update = replace(Shipments, 'updateAsync',
            async (...args) => {
              if (args[1].$set?.['dispatch.token']) await claim.wait();
              return shipment_update.apply(Shipments, args);
            });
          second = (caller == 'start' ? start() : end_shipment(
            { _id: 'parent' }, 0, { shipment_id: 'parent-source' },
          )).catch(error => error);
          await claim.reached;
          deletion.resume();
          await deleting;
          admission.resume();
          const first_error = await first;
          expect(first_error.error).to.eq('lane-not-found');
          claim.resume();
          const second_error = await second;
          expect(second_error.error).to.eq(caller == 'start' ?
            'lane-not-found' : 'shipment-pending');
          expect(second_error.reason).to.include('Lane not found');
          const later_error = await fails(start, 'lane-not-found');
          expect(later_error.reason).to.eq(first_error.reason);
          const saved = await Shipments.findOneAsync('source');
          expect(saved.active).to.eq(false);
          expect(saved.dispatch.pending).to.eq(false);
          expect(saved.dispatch.started).to.eq(undefined);
          expect(effects).to.eq(0);
          if (caller == 'completion') {
            const parent = await Shipments.findOneAsync('parent-source');
            expect(parent.completion.pending).to.eq(true);
            expect(parent.completion.return_id).to.eq(undefined);
            expect(parent.completion.error).to.include('Lane not found');
          }
        }
        finally {
          deletion.resume();
          admission.resume();
          claim.resume();
          await Promise.allSettled([deleting, first, second]);
        }
      });
  });

  it('requires a reset even when the latest shipment appears inactive',
    async () => {
      await Shipments.insertAsync({ _id: 'older', lane: 'lane', active: true });
      await Lanes.updateAsync('lane', { $set: {
        last_shipment: { active: false },
      } });
      const error = await fails(remove, 'lane-active');
      expect(error.reason).to.include('Reset it before deleting');
      expect(await Lanes.findOneAsync('lane')).to.exist;
      expect((await Harbors.findOneAsync('test')).lanes.lane).to.exist;
    });

  ['dispatch', 'completion'].forEach(stage => {
    it(`keeps a lane with pending ${stage} work`, async () => {
      await Shipments.insertAsync({ lane: 'lane', active: false,
        [stage]: { pending: true },
      });
      const error = await fails(remove, 'lane-pending');
      expect(error.reason).to.include('Wait for it to finish');
      expect(await Lanes.findOneAsync('lane')).to.exist;
    });
  });

  it('allows deletion after an active shipment is reset', async () => {
    await start();
    await fails(remove, 'lane-active');
    await reset_shipment('lane', 'planned');
    await remove();
    expect(await Lanes.findOneAsync('lane')).to.eq(undefined);
    expect((await Harbors.findOneAsync('test')).lanes.lane).to.eq(undefined);
    expect((await Harbors.findOneAsync('test')).lanes.other).to.exist;
  });

  it('keeps a lane when a start advances its revision during deletion',
    async () => {
      const remove_lane = replace(Lanes, 'removeAsync', async (...args) => {
        await start();
        return remove_lane.apply(Lanes, args);
      });
      await fails(remove, 'lane-active');
      expect(await Lanes.findOneAsync('lane')).to.exist;
      expect(effects).to.eq(1);
    });

  it('rejects a changed idle revision without removing its configuration',
    async () => {
      const remove_lane = replace(Lanes, 'removeAsync', async (...args) => {
        await Lanes.updateAsync('lane', { $inc: { shipment_history: 1 } });
        return remove_lane.apply(Lanes, args);
      });
      await fails(remove, 'lane-changed');
      expect((await Harbors.findOneAsync('test')).lanes.lane).to.exist;
    });

  it('is idempotent when the lane was already removed', async () => {
    await remove();
    expect(await delete_lane({ _id: 'lane' })).to.eq(0);
  });

  it('stops work when deletion wins before insertion', async () => {
    const upsert = replace(Shipments, 'upsertAsync', async (...args) => {
      await remove();
      return upsert.apply(Shipments, args);
    });
    await fails(start, 'lane-not-found');
    const saved = await Shipments.findOneAsync('source');
    expect(saved.active).to.eq(false);
    expect(saved.dispatch.pending).to.eq(false);
    expect(saved.dispatch.started).to.eq(undefined);
    expect(effects).to.eq(0);
    let error;
    try { await start(); }
    catch (caught) { error = caught; }
    expect(error?.message).to.include('Lane not found');
  });

  it('stops work when deletion wins after insertion but before admission',
    async () => {
      let began;
      let release;
      const reached = new Promise(resolve => { began = resolve; });
      const ready = new Promise(resolve => { release = resolve; });
      const remove_lane = replace(Lanes, 'removeAsync', async (...args) => {
        began();
        await ready;
        return remove_lane.apply(Lanes, args);
      });
      const deleting = remove();
      let starting;
      try {
        await reached;
        const update = replace(Lanes, 'updateAsync', async (...args) => {
          if (args[0].shipment_history) {
            release();
            await deleting;
          }
          return update.apply(Lanes, args);
        });
        starting = start();
        await fails(() => starting, 'lane-not-found');
        const saved = await Shipments.findOneAsync('source');
        expect(saved.active).to.eq(false);
        expect(saved.dispatch.started).to.eq(undefined);
        expect(effects).to.eq(0);
      }
      finally {
        release();
        await Promise.allSettled([deleting, starting]);
      }
    });

  it('recovers an insert whose acknowledgment was lost after deletion',
    async () => {
      const upsert = replace(Shipments, 'upsertAsync', async (...args) => {
        await remove();
        await upsert.apply(Shipments, args);
        throw new Error('insert acknowledgment lost');
      });
      let error;
      try { await start(); }
      catch (caught) { error = caught; }
      expect(error?.message).to.eq('insert acknowledgment lost');
      Shipments.upsertAsync = upsert;
      await Promise.all(await recover_shipments());
      expect((await Shipments.findOneAsync('source')).active).to.eq(false);
      expect(effects).to.eq(0);
    });

  it('keeps an unknown started outcome available for reconciliation',
    async () => {
      await Shipments.insertAsync({ _id: 'source', lane: 'missing',
        active: true, dispatch: { pending: true, started: new Date() },
      });
      await Promise.all(await recover_shipments());
      const saved = await Shipments.findOneAsync('source');
      expect(saved.active).to.eq(true);
      expect(saved.dispatch.pending).to.eq(true);
      expect(effects).to.eq(0);
    });
});
