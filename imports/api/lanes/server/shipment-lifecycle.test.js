import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Lanes } from '..';
import { Shipments } from '../../shipments';
import { Harbors } from '../../harbors';
import {
  start_shipment, end_shipment, delete_lane,
} from './methods';

describe('Shipment lifecycle', () => {
  const restores = [];
  const replace = (target, key, value) => {
    const previous = target[key];
    restores.push(() => { target[key] = previous; });
    target[key] = value;
    return previous;
  };
  const finish = () => end_shipment({ _id: 'parent' }, 0,
    { shipment_id: 'source' });
  const fail_parent = () => {
    const update = Shipments.updateAsync;
    replace(Shipments, 'updateAsync', async (...args) => {
      if (args[0]._id == 'source' && args[1].$set?.completion &&
        !args[1].$set.completion.pending) {
        throw new Error('parent finalization unavailable');
      }
      return update.apply(Shipments, args);
    });
    return () => { Shipments.updateAsync = update; };
  };
  const interrupt = async () => {
    let error;
    try { await finish(); }
    catch (caught) { error = caught; }
    expect(error?.error).to.eq('shipment-pending');
    expect(error.reason).to.eq('parent finalization unavailable');
  };
  let effects;
  beforeEach(async () => {
    await resetDatabase();
    effects = 0;
    replace(H, 'harbors', { test: {} });
    await Lanes.insertAsync({ _id: 'parent', type: 'test',
      followup: { _id: 'child' },
    });
    await Lanes.insertAsync({ _id: 'child', type: 'test',
      salvage_plan: { _id: 'salvage' },
    });
    await Lanes.insertAsync({ _id: 'salvage', type: 'test' });
    await Harbors.insertAsync({ _id: 'test', lanes: {
      child: { manifest: { input: true } }, salvage: { manifest: {} },
    } });
    await Shipments.insertAsync({ _id: 'source', lane: 'parent', active: true,
      actual: new Date(), stdout: {}, stderr: {},
      manifest: { shipment_id: 'source' },
    });
  });
  afterEach(() => {
    while (restores.length) restores.pop()();
  });

  const values = [undefined, null, false, 0, '', 'result',
    { successful_result: true }, ['result'], new Date(100000)];
  ['ordinary', 'synchronous', 'followup', 'error'].forEach(mode => {
    values.forEach((expected, index) => {
      it(`preserves ${mode} return ${index} through parent repair`,
        async () => {
          if (mode == 'followup') {
            await Lanes.updateAsync('child', {
              $set: { followup: { _id: 'salvage' } },
            });
          }
          H.harbors.test.work = async (lane, manifest) => {
            effects++;
            if (lane._id == 'salvage') return expected;
            if (mode == 'error') return { ...manifest, error: 'failed' };
            if (mode == 'followup') return end_shipment(lane, 0, manifest);
            if (mode == 'synchronous') await end_shipment(lane, 0, manifest);
            return expected;
          };
          const restore = fail_parent();
          await interrupt();
          const completed_effects = effects;
          restore();
          const result = await finish();
          expect(effects).to.eq(completed_effects);
          expect(result).to.deep.eq(expected);
        });
    });
  });

  it('settles a parent after its completed child lane was deleted',
    async () => {
      H.harbors.test.work = async (lane, manifest) => {
        effects++;
        return end_shipment(lane, 0, manifest);
      };
      const restore = fail_parent();
      await interrupt();
      restore();
      const child = await Shipments.findOneAsync({ lane: 'child' });
      expect(child.active).to.eq(false);
      await delete_lane(await Lanes.findOneAsync('child'));
      await finish();
      expect((await Shipments.findOneAsync('source')).completion.pending)
        .to.eq(undefined);
      expect(effects).to.eq(1);
    });

  it('records a completed outcome after its source lane was deleted',
    async () => {
      await Lanes.updateAsync('parent', { $unset: { followup: '' } });
      const lane = await Lanes.findOneAsync('parent');
      // Legacy records may reference a lane removed outside the delete RPC.
      await Lanes.removeAsync(lane._id);
      await end_shipment(lane, 0, { shipment_id: 'source', result: 'done' });
      const saved = await Shipments.findOneAsync('source');
      expect(saved.active).to.eq(false);
      expect(saved.finished).to.be.instanceOf(Date);
      expect(saved.manifest.result).to.eq('done');
    });

  [undefined, 0, 100].forEach(initial => {
    it(`passes the incremented count to work (${initial})`, async () => {
      if (initial !== undefined) {
        await Lanes.updateAsync('child', { $set: { shipment_count: initial } });
      }
      let observed;
      H.harbors.test.work = async (lane, manifest) => {
        observed = { passed: lane.shipment_count,
          stored: (await Lanes.findOneAsync(lane._id)).shipment_count,
        };
        return manifest;
      };
      await start_shipment('child', {}, 'planned', 'counter');
      expect(observed.stored).to.eq((initial || 0) + 1);
      expect(observed.passed).to.eq(observed.stored);
    });
  });

  ['baseline', 'outcome', 'history'].forEach(stage => {
    it(`finishes when the source lane is deleted during ${stage}`,
      async () => {
        H.harbors.test.work = (lane, manifest) => {
          effects++;
          return manifest;
        };
        const target = stage == 'outcome' ? Shipments : Lanes;
        const update = target.updateAsync;
        replace(target, 'updateAsync', async (...args) => {
          const matches = stage == 'outcome' ?
            args[0]._id == 'source' && args[1].$set?.active === false :
            args[0]._id == 'parent' && (stage == 'baseline' ?
              args[0].shipment_totals : args[0].shipment_history);
          if (matches && stage != 'outcome') await Lanes.removeAsync('parent');
          const saved = await update.apply(target, args);
          if (matches && stage == 'outcome') await Lanes.removeAsync('parent');
          return saved;
        });
        await end_shipment({ _id: 'parent' }, 0,
          { shipment_id: 'source', result: 'completed' });
        const source = await Shipments.findOneAsync('source');
        expect(source.active).to.eq(false);
        expect(source.manifest.result).to.eq('completed');
        expect(source.completion.pending).to.eq(undefined);
        expect(await Lanes.findOneAsync('parent')).to.eq(undefined);
        expect(effects).to.eq(1);
      });
  });
});
