import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { patches, rejects } from '../../../test-helpers/async';
import { Lanes } from '..';
import { Harbors } from '../../harbors';
import { Shipments } from '../../shipments';
import { ShipmentReturns } from '../../shipments/server/returns';
import { start_shipment, recover_shipments } from './methods';

describe('Harbor dispatch handoff', () => {
  const { replace, restore_all } = patches();
  const start = () => start_shipment('lane', {}, 'planned', 'source');
  let work;
  let resumed;

  beforeEach(async () => {
    await resetDatabase();
    work = 0;
    resumed = 0;
    replace(console, 'error', () => {});
    replace(H, 'harbors', { test: {
      work: (lane, manifest) => { work++; return manifest; },
      resume_shipment: async (lane, shipment) => {
        resumed++;
        expect(lane._id).to.eq('lane');
        expect(shipment.active).to.eq(true);
        expect(shipment.dispatch.pending).to.eq(true);
        const recorded = await ShipmentReturns.findOneAsync(
          shipment.dispatch.return_id,
        );
        expect(recorded.value).to.deep.eq(shipment.manifest);
      },
    } });
    await Lanes.insertAsync({ _id: 'lane', type: 'test' });
    await Harbors.insertAsync({ _id: 'test', lanes: {
      lane: { manifest: { input: 'original' } },
    } });
  });
  afterEach(restore_all);

  it('hands off only after the return is durable, before settling dispatch',
    async () => {
      const value = await start();
      expect(resumed).to.eq(1);
      expect(work).to.eq(1);
      expect((await Shipments.findOneAsync('source')).dispatch.pending)
        .to.eq(undefined);
      expect(await start()).to.deep.eq(value);
      expect(resumed).to.eq(1);
    });

  it('retries a failed handoff from the captured return without repeating work',
    async () => {
      const resume = H.harbors.test.resume_shipment;
      H.harbors.test.resume_shipment = () => {
        throw new Error('handoff unavailable');
      };
      await rejects(start, 'handoff unavailable');
      expect((await Shipments.findOneAsync('source')).dispatch.pending)
        .to.eq(true);
      H.harbors.test.resume_shipment = resume;
      await Promise.all(await recover_shipments());
      expect(work).to.eq(1);
      expect(resumed).to.eq(1);
      expect((await Shipments.findOneAsync('source')).dispatch.pending)
        .to.eq(undefined);
    });

  it('skips handoff if completion wins while the return is captured',
    async () => {
      const upsert = replace(ShipmentReturns, 'upsertAsync', async (
        ...args
      ) => {
        const value = await upsert.apply(ShipmentReturns, args);
        await Shipments.updateAsync('source', { $set: { active: false } });
        return value;
      });
      await start();
      expect(work).to.eq(1);
      expect(resumed).to.eq(0);
      expect((await Shipments.findOneAsync('source')).active).to.eq(false);
    });
});
