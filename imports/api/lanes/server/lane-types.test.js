import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Lanes } from '..';
import { Shipments } from '../../shipments';
import { Harbors } from '../../harbors';
import { upsert, delete_lane } from './methods';
import { update_harbor } from '../../harbors/server/methods';

describe('Lane harbor types', () => {
  let harbors;
  let call;
  let effects;
  const fails = async (work, message) => {
    let error;
    try { await work(); }
    catch (caught) { error = caught; }
    expect(error?.message).to.include(message);
  };

  beforeEach(async () => {
    await resetDatabase();
    harbors = H.harbors;
    call = H.call;
    effects = 0;
    H.harbors = Object.fromEntries(['one', 'two'].map(type => [type, {
      update: () => { effects++; return true; },
    }]));
    H.call = async (method, lane) => lane;
    for (const _id of ['one', 'two']) await Harbors.insertAsync({ _id });
  });

  afterEach(() => {
    H.harbors = harbors;
    H.call = call;
  });

  const saves = {
    lane: lane => upsert(lane),
    harbor: lane => update_harbor(lane, {}),
  };
  Object.entries(saves).forEach(([path, save]) => {
    ['two', false, null, ''].forEach(type => {
      it(`rejects replacing or clearing an assigned type via ${path}: ${type}`,
        async () => {
          await Lanes.insertAsync({ _id: 'lane', type: 'one' });
          await fails(() => save({ _id: 'lane', type }), 'cannot be changed');
          expect((await Lanes.findOneAsync('lane')).type).to.eq('one');
          expect(effects).to.eq(0);
          expect((await Harbors.findOneAsync('two')).lanes).to.eq(undefined);
        });
    });

    [undefined, false, null, ''].forEach(type => {
      it(`allows initial assignment via ${path}: ${type}`, async () => {
        const lane = { _id: 'lane' };
        if (type !== undefined) lane.type = type;
        await Lanes.insertAsync(lane);
        await save({ _id: 'lane', type: 'one' });
        expect((await Lanes.findOneAsync('lane')).type).to.eq('one');
      });
    });

    it(`keeps the first assignment under concurrent ${path} saves`,
      async () => {
        await Lanes.insertAsync({ _id: 'lane' });
        const find = Lanes.findOneAsync;
        let release;
        let reads = 0;
        const ready = new Promise(resolve => { release = resolve; });
        Lanes.findOneAsync = async (...args) => {
          const current = await find.apply(Lanes, args);
          if (current?._id == 'lane' && current.type === undefined) {
            if (++reads == 2) release();
            await ready;
          }
          return current;
        };
        let results;
        try {
          results = await Promise.allSettled(['one', 'two'].map(type =>
            save({ _id: 'lane', type })));
        }
        finally { Lanes.findOneAsync = find; }
        expect(results.filter(result => result.status == 'fulfilled'))
          .to.have.length(1);
        expect(['one', 'two']).to.include(
          (await Lanes.findOneAsync('lane')).type,
        );
        if (path == 'harbor') expect(effects).to.eq(1);
      });
  });

  it('preserves type when an edit omits it or supplies a dotted field',
    async () => {
      await Lanes.insertAsync({ _id: 'lane', type: 'one' });
      await upsert({ _id: 'lane', name: 'Edited', 'type.nested': 'two' });
      const saved = await Lanes.findOneAsync('lane');
      expect(saved.type).to.eq('one');
      expect(saved.name).to.eq('Edited');
    });

  for (const identity of [{ slug: 'same' }, { name: 'Same' }]) {
    it(`validates the actual lane matched by ${Object.keys(identity)[0]}`,
      async () => {
        await Lanes.insertAsync({ _id: 'lane', ...identity, type: 'one' });
        await fails(() => upsert({ ...identity, type: 'two' }),
          'cannot be changed');
        expect(await Lanes.find().countAsync()).to.eq(1);
      });
  }

  it('fences concurrent creation with the same lane ID', async () => {
    const results = await Promise.allSettled(['one', 'two'].map(type =>
      upsert({ _id: 'new', type })));
    expect(results.filter(result => result.status == 'fulfilled'))
      .to.have.length(1);
    expect(await Lanes.find().countAsync()).to.eq(1);
  });

  it('requires a new identity after deleting a lane with shipment history',
    async () => {
      const lane = { _id: 'old', type: 'one', slug: 'same' };
      await Lanes.insertAsync(lane);
      await Shipments.insertAsync({ lane: 'old', active: true });
      await delete_lane(lane);
      await fails(() => upsert({ ...lane, type: 'two' }),
        'Cannot reuse a lane ID');
      const replacement = await upsert({ slug: 'same', type: 'two' });
      expect(replacement._id).not.to.eq('old');
      expect((await Shipments.findOneAsync({ lane: 'old' })).lane).to.eq('old');
    });

  it('rejects settings for a missing lane before calling a harbor',
    async () => {
      await fails(() => update_harbor({ _id: 'missing', type: 'one' }, {}),
        'Lane not found');
      expect(effects).to.eq(0);
    });
});
