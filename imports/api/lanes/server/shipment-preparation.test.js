import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Lanes } from '..';
import { Shipments } from '../../shipments';
import { Harbors } from '../../harbors';
import { end_shipment, recover_shipments } from './methods';

describe('Shipment preparation', () => {
  const restores = [];
  const replace = (target, key, value) => {
    const previous = target[key];
    restores.push(() => { target[key] = previous; });
    target[key] = value;
    return previous;
  };
  const recover = async () => Promise.all(await recover_shipments());
  const finish = () => end_shipment({ _id: 'parent' }, 0,
    { shipment_id: 'source', result: 'parent result' });
  const continue_with = (next) => Shipments.updateAsync('source', { $set: {
    active: false, completion: { pending: true, failed: false, next },
  } });
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
    replace(H, 'harbors', { test: { work: (lane, manifest) => {
      effects++;
      return manifest;
    } } });
    await Lanes.insertAsync({ _id: 'parent', type: 'test',
      followup: { _id: 'child' },
    });
    await Lanes.insertAsync({ _id: 'child', type: 'test' });
    await Harbors.insertAsync({ _id: 'test', lanes: {
      child: { manifest: { setting: 'original' } },
    } });
    await Shipments.insertAsync({ _id: 'source', lane: 'parent', active: true,
      actual: new Date(), stdout: {}, stderr: {},
      manifest: { shipment_id: 'source' },
    });
  });
  afterEach(() => {
    while (restores.length) restores.pop()();
  });

  it('completes large parent and child inputs without combining them',
    async () => {
      const large = 'x'.repeat(9 * 1024 * 1024);
      await Harbors.updateAsync('test', {
        $set: { 'lanes.child.manifest': { payload: large } },
      });
      H.harbors.test.work = (lane, manifest) => {
        effects++;
        return end_shipment(lane, 0, manifest);
      };
      const result = await end_shipment({ _id: 'parent' }, 0,
        { shipment_id: 'source', prior_manifest: { payload: large } });
      const parent = await Shipments.findOneAsync('source');
      const child = await Shipments.findOneAsync({ lane: 'child' });
      expect(parent.manifest.prior_manifest.payload.length).to.eq(large.length);
      expect(parent.completion.pending).to.eq(undefined);
      expect(child.active).to.eq(false);
      expect(child.manifest.payload.length).to.eq(large.length);
      expect(child.manifest.prior_manifest.prior_manifest).to.eq(undefined);
      expect(result.payload.length).to.eq(large.length);
      expect(effects).to.eq(1);
    });

  it('keeps prepared work dormant until its parent publishes the child',
    async () => {
      const update = Shipments.updateAsync;
      replace(Shipments, 'updateAsync', async (...args) => {
        if (args[1].$set && args[1].$set['completion.next']) {
          throw new Error('parent checkpoint unavailable');
        }
        return update.apply(Shipments, args);
      });
      await fails(finish, 'parent checkpoint unavailable');
      const child = await Shipments.findOneAsync({ lane: 'child' });
      expect(child).to.exist;
      expect(child.dispatch.pending).to.eq(false);
      expect(child.dispatch.started).to.eq(undefined);
      expect(effects).to.eq(0);
      await Harbors.updateAsync('test', {
        $set: { 'lanes.child.manifest': { setting: 'changed' } },
      });
      Shipments.updateAsync = update;
      await recover();
      const resumed = await Shipments.findOneAsync(child._id);
      expect(resumed.actual).to.deep.eq(child.actual);
      expect(resumed.start).to.eq(child.start);
      expect(resumed.manifest.setting).to.eq('original');
      expect(await Shipments.find({ lane: 'child' }).countAsync()).to.eq(1);
      expect(effects).to.eq(1);
    });

  it('reuses prepared input after a lost parent checkpoint acknowledgment',
    async () => {
      const update = Shipments.updateAsync;
      replace(Shipments, 'updateAsync', async (...args) => {
        const result = await update.apply(Shipments, args);
        if (args[1].$set && args[1].$set['completion.next']) {
          throw new Error('parent acknowledgment lost');
        }
        return result;
      });
      await fails(finish, 'parent acknowledgment lost');
      const parent = await Shipments.findOneAsync('source');
      const child = await Shipments.findOneAsync(parent.completion.next
        .shipment_id);
      expect(child).to.exist;
      expect(child.dispatch.pending).to.eq(false);
      expect(parent.completion.next.manifest).to.eq(undefined);
      await Harbors.updateAsync('test', { $unset: { 'lanes.child': '' } });
      Shipments.updateAsync = update;
      await recover();
      expect((await Shipments.findOneAsync(child._id)).manifest.setting)
        .to.eq('original');
      expect(effects).to.eq(1);
    });

  it('reuses prepared input after a lost creation acknowledgment', async () => {
    const upsert = Shipments.upsertAsync;
    replace(Shipments, 'upsertAsync', async (...args) => {
      await upsert.apply(Shipments, args);
      throw new Error('creation acknowledgment lost');
    });
    await fails(finish, 'creation acknowledgment lost');
    const child = await Shipments.findOneAsync({ lane: 'child' });
    expect(child.dispatch.pending).to.eq(false);
    expect(effects).to.eq(0);
    await Harbors.updateAsync('test', { $unset: { 'lanes.child': '' } });
    Shipments.upsertAsync = upsert;
    await recover();
    const saved = await Shipments.findOneAsync(child._id);
    expect(saved.actual).to.deep.eq(child.actual);
    expect(saved.start).to.eq(child.start);
    expect(saved.manifest.setting).to.eq('original');
    expect(await Shipments.find({ lane: 'child' }).countAsync()).to.eq(1);
    expect(effects).to.eq(1);
  });

  it('recovers after activation succeeds but its acknowledgment is lost',
    async () => {
      const update = Shipments.updateAsync;
      replace(Shipments, 'updateAsync', async (...args) => {
        const result = await update.apply(Shipments, args);
        if (args[1].$set && args[1].$set['dispatch.pending'] === true) {
          throw new Error('activation acknowledgment lost');
        }
        return result;
      });
      await fails(finish, 'activation acknowledgment lost');
      expect(effects).to.eq(0);
      Shipments.updateAsync = update;
      await recover();
      await recover();
      expect(await Shipments.find({ lane: 'child' }).countAsync()).to.eq(1);
      expect(effects).to.eq(1);
      expect((await Shipments.findOneAsync('source')).completion.pending)
        .to.eq(undefined);
    });

  it('preserves a legacy resolved snapshot when preparing its child',
    async () => {
      await continue_with({
        lane: 'child', shipment_id: 'legacy-child', start: 'saved-start',
        manifest: { setting: 'legacy' },
      });
      await recover();
      const child = await Shipments.findOneAsync('legacy-child');
      expect(child.manifest.setting).to.eq('legacy');
      expect(child.start).to.eq('saved-start');
      expect(child.manifest.prior_manifest.shipment_id).to.eq('source');
      expect(effects).to.eq(1);
    });

  [undefined, '', 42].forEach(shipment_id => {
    it(`rejects an invalid continuation id of ${shipment_id}`, async () => {
      await continue_with({ shipment_id, reference: { _id: 'child' } });
      await fails(finish, 'Invalid next shipment id');
      expect(await Shipments.find({}).countAsync()).to.eq(1);
      expect(effects).to.eq(0);
    });
  });

  it('rejects a prepared child that belongs to another lane', async () => {
    await Shipments.insertAsync({ _id: 'foreign', lane: 'parent',
      active: true, manifest: {}, dispatch: { pending: false },
    });
    await continue_with({ shipment_id: 'foreign',
      reference: { _id: 'child' },
    });
    await fails(finish, 'Shipment belongs to another lane');
    expect((await Shipments.findOneAsync('foreign')).dispatch.pending)
      .to.eq(false);
    expect(effects).to.eq(0);
  });

  it('reuses a child selected by slug even if routing settings change',
    async () => {
      await Lanes.updateAsync('child', { $set: { slug: 'target' } });
      await Lanes.updateAsync('parent', {
        $set: { followup: { slug: 'target' } },
      });
      const update = Shipments.updateAsync;
      replace(Shipments, 'updateAsync', async (...args) => {
        if (args[1].$set && args[1].$set['completion.next']) {
          throw new Error('parent checkpoint unavailable');
        }
        return update.apply(Shipments, args);
      });
      await fails(finish, 'parent checkpoint unavailable');
      await Lanes.updateAsync('child', { $set: { slug: 'renamed' } });
      await Harbors.updateAsync('test', { $unset: { 'lanes.child': '' } });
      Shipments.updateAsync = update;
      await recover();
      expect(await Shipments.find({ lane: 'child' }).countAsync()).to.eq(1);
      expect(effects).to.eq(1);
    });

  it('leaves previously started work held when its parent retries',
    async () => {
      const started = new Date();
      await Shipments.insertAsync({ _id: 'held', lane: 'child',
        start: 'saved-start', actual: new Date(), active: true,
        manifest: { shipment_id: 'held' },
        dispatch: { pending: false, started, error: 'Unknown outcome' },
      });
      await continue_with({ lane: 'child', shipment_id: 'held' });
      await finish();
      expect((await Shipments.findOneAsync('held')).dispatch).to.deep.eq({
        pending: false, started, error: 'Unknown outcome',
      });
      expect(effects).to.eq(0);
    });

  ['text result', null].forEach(result => {
    it(`retains a downstream return value of ${result} during repair`,
      async () => {
        H.harbors.test.work = () => { effects++; return result; };
        const update = Shipments.updateAsync;
        replace(Shipments, 'updateAsync', async (...args) => {
          if (args[1].$set && args[1].$set.completion &&
            !args[1].$set.completion.pending) {
            throw new Error('completion unavailable');
          }
          return update.apply(Shipments, args);
        });
        await fails(finish, 'completion unavailable');
        Shipments.updateAsync = update;
        expect(await finish()).to.eq(result);
        expect(effects).to.eq(1);
      });
  });
});
