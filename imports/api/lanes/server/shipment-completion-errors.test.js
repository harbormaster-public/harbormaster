import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Lanes } from '..';
import { Shipments } from '../../shipments';
import { Harbors } from '../../harbors';
import { ShipmentReturns } from '../../shipments/server/returns';
import { start_shipment, end_shipment, recover_shipments } from './methods';

describe('Shipment completion errors', () => {
  const restores = [];
  const replace = (target, key, value) => {
    const previous = target[key];
    restores.push(() => { target[key] = previous; });
    target[key] = value;
    return previous;
  };
  const start = () => start_shipment('lane', {}, 'planned', 'source');
  const finish = () => end_shipment({ _id: 'lane' }, 0,
    { shipment_id: 'source' });
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
    replace(H, 'harbors', { test: { work: (lane, manifest) => {
      effects++;
      return manifest;
    } } });
    await Lanes.insertAsync({ _id: 'lane', type: 'test' });
  });

  afterEach(() => {
    while (restores.length) restores.pop()();
  });

  const faults = [
    'lookup', 'lane-read', 'outcome-before', 'outcome-after',
    'claim', 'accounting', 'history', 'return', 'receipt', 'release',
  ];
  faults.forEach(fault => {
    it(`propagates ${fault} failures without recording a business error`,
      async () => {
        let fail = true;
        let completing = false;
        const unavailable = () => {
          fail = false;
          throw new Error(`${fault} unavailable`);
        };
        const find = replace(Shipments, 'findOneAsync', async (...args) => {
          if (completing && fail && fault == 'lookup') unavailable();
          return find.apply(Shipments, args);
        });
        const lane_read = replace(Lanes, 'findOneAsync', async (...args) => {
          if (completing && fail && fault == 'lane-read') unavailable();
          return lane_read.apply(Lanes, args);
        });
        const update = replace(Shipments, 'updateAsync', async (...args) => {
          const modifier = args[1];
          if (completing && fail) {
            if (fault.startsWith('outcome') &&
              modifier.$set?.active === false) {
              if (fault == 'outcome-after') {
                await update.apply(Shipments, args);
              }
              unavailable();
            }
            if (fault == 'claim' && modifier.$set?.['completion.token']) {
              unavailable();
            }
            if (fault == 'receipt' && modifier.$set?.completion &&
              !modifier.$set.completion.pending) unavailable();
            if (fault == 'release' &&
              modifier.$unset?.['completion.token'] !== undefined) {
              unavailable();
            }
          }
          return update.apply(Shipments, args);
        });
        const count = replace(Lanes, 'updateAsync', async (...args) => {
          if (completing && fail) {
            if (fault == 'accounting' && args[1].$max &&
              (await Shipments.findOneAsync('source')).active === false) {
              unavailable();
            }
            if (fault == 'history' && args[0].shipment_history) unavailable();
          }
          return count.apply(Lanes, args);
        });
        const upsert = replace(
          ShipmentReturns, 'upsertAsync', async (...args) => {
            if (completing && fail && fault == 'return') unavailable();
            return upsert.apply(ShipmentReturns, args);
          },
        );
        H.harbors.test.work = async (lane, manifest) => {
          effects++;
          completing = true;
          return await H.call('Lanes#end_shipment', lane, 0, manifest);
        };
        const error = await fails(start, `${fault} unavailable`);
        expect(error.error).to.eq('shipment-pending');
        expect(fail).to.eq(false);
        Shipments.findOneAsync = find;
        Shipments.updateAsync = update;
        Lanes.findOneAsync = lane_read;
        Lanes.updateAsync = count;
        ShipmentReturns.upsertAsync = upsert;
        await recover();
        const before_outcome = ['lookup', 'lane-read', 'outcome-before']
          .includes(fault);
        if (before_outcome) await finish();
        const saved = await Shipments.findOneAsync('source');
        expect(saved.exit_code).to.eq(0);
        expect(saved.manifest.error).to.eq(undefined);
        expect(saved.completion.pending).to.eq(undefined);
        expect(saved.dispatch.has_result).to.eq(undefined);
        expect(await ShipmentReturns.findOneAsync(saved.dispatch.return_id))
          .to.eq(undefined);
        const result = await ShipmentReturns.findOneAsync(
          saved.completion.return_id,
        );
        expect(result.value.error).to.eq(undefined);
        await fails(start, 'reconcile');
        expect(effects).to.eq(1);
      });
  });

  it('preserves an already typed completion error and its diagnostic',
    async () => {
      await start();
      const expected = new H.Error('shipment-pending',
        'database temporarily unavailable', 'original diagnostic');
      replace(Lanes, 'findOneAsync', async () => { throw expected; });
      const error = await fails(finish, 'database temporarily unavailable');
      expect(error).to.eq(expected);
      expect(error.reason).to.eq('database temporarily unavailable');
      expect(error.details).to.eq('original diagnostic');
    });

  it('keeps argument and ownership errors outside the retry boundary',
    async () => {
      const invalid = await fails(() => end_shipment(), 'Invalid arguments');
      expect(invalid).to.be.instanceOf(TypeError);
      expect(invalid.error).to.eq(undefined);
      await start();
      const wrong_lane = await fails(() => end_shipment({ _id: 'other' }, 0,
        { shipment_id: 'source' }), 'another lane');
      expect(wrong_lane.error).to.eq(undefined);
      expect((await Shipments.findOneAsync('source')).active).to.eq(true);
    });

  ['throw', 'return', 'arguments', 'ownership'].forEach(mode => {
    it(`still runs salvage for a genuine harbor failure: ${mode}`, async () => {
      await Lanes.updateAsync('lane', {
        $set: { salvage_plan: { _id: 'salvage' } },
      });
      await Lanes.insertAsync({ _id: 'salvage', type: 'test' });
      await Harbors.insertAsync({ _id: 'test', lanes: {
        salvage: { manifest: {} },
      } });
      H.harbors.test.work = async (lane, manifest) => {
        effects++;
        if (lane._id == 'salvage') return { salvaged: true };
        if (mode == 'return') return { ...manifest, error: 'business failure' };
        if (mode == 'arguments') {
          return await H.call('Lanes#end_shipment', null, 0, manifest);
        }
        if (mode == 'ownership') {
          return await H.call('Lanes#end_shipment', { _id: 'other' }, 0,
            manifest);
        }
        throw new Error('business failure');
      };
      expect(await start()).to.deep.eq({ salvaged: true });
      expect(await start()).to.deep.eq({ salvaged: true });
      const saved = await Shipments.findOneAsync('source');
      expect(saved.exit_code).to.eq(1);
      expect(saved.completion.failed).to.eq(true);
      expect(saved.manifest.error).to.be.a('string');
      expect((await Lanes.findOneAsync('lane')).salvage_runs).to.eq(1);
      expect(effects).to.eq(2);
    });
  });
});
