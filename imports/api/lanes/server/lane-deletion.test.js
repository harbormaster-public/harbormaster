import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Lanes } from '..';
import { Shipments } from '../../shipments';
import { Harbors } from '../../harbors';
import {
  delete_lane, start_shipment, reset_shipment, recover_shipments,
} from './methods';

const fails = async (work, code) => {
  let error;
  try { await work(); }
  catch (caught) { error = caught; }
  expect(error?.error).to.eq(code);
  return error;
};

describe('Idle lane deletion', () => {
  const restores = [];
  const replace = (target, key, value) => {
    const previous = target[key];
    restores.push(() => { target[key] = previous; });
    target[key] = value;
    return previous;
  };
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
  afterEach(() => { while (restores.length) restores.pop()(); });

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
