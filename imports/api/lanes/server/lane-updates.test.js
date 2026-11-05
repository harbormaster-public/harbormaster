import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Lanes } from '..';
import { Shipments, LatestShipment } from '../../shipments';
import { Harbors } from '../../harbors';
import {
  upsert, publish_lanes, start_shipment, end_shipment,
} from './methods';
import {
  prepare_shipment_totals, update_shipment_history,
} from './shipment-state';
import {
  update_harbor, render_work_preview,
} from '../../harbors/server/methods';

describe('Lane updates', () => {
  let harbors;
  let call;
  beforeEach(async () => {
    await resetDatabase();
    harbors = H.harbors;
    call = H.call;
    H.harbors = { test: {
      update: () => true,
      render_work_preview: () => 'updated preview',
      work: (lane, manifest) => manifest,
    } };
    H.call = async (method, ...args) => {
      expect(method).to.eq('Harbors#render_work_preview');
      return render_work_preview(...args);
    };
  });
  afterEach(() => {
    H.harbors = harbors;
    H.call = call;
  });

  it('rejects malformed updates without creating lanes', async () => {
    for (const value of [null, 'lane', 7, true, []]) {
      let error;
      try { await upsert(value); }
      catch (caught) { error = caught; }
      expect(error).to.be.instanceOf(TypeError);
    }
    expect(await Lanes.find().countAsync()).to.eq(0);
  });

  for (const snapshot of ['full', 'published']) {
    it(`preserves shipment state across both saves of a ${snapshot} edit`,
      async () => {
        await Lanes.insertAsync({ _id: 'lane', slug: 'lane', type: 'test',
          shipment_count: 100, salvage_runs: 7,
        });
        await Harbors.insertAsync({ _id: 'test', lanes: {
          lane: { manifest: {} },
        } });
        await Shipments.insertAsync({ _id: 'old', lane: 'lane', active: true,
          actual: new Date(Date.now() - 10000), stdout: {}, stderr: {},
          manifest: { shipment_id: 'old' },
        });
        await prepare_shipment_totals('lane');
        await update_shipment_history('lane');
        const stale = snapshot == 'full' ? await Lanes.findOneAsync('lane') :
          (await publish_lanes('/edit', 'lane').fetchAsync())[0];
        const response = await update_harbor(stale, { setting: 'edited' });
        await end_shipment({ _id: 'lane' }, 0, { shipment_id: 'old' });
        const manifest = {};
        await start_shipment('lane', manifest, 'planned', 'latest');
        await end_shipment({ _id: 'lane' }, 0, manifest);
        const completed = await Lanes.findOneAsync('lane');

        // The edit client sends the returned snapshot in a second RPC.
        const saved = await upsert(response.lane);
        expect(saved.last_shipment).to.deep.eq(completed.last_shipment);
        expect(saved.shipment_count).to.eq(101);
        expect(saved.salvage_runs).to.eq(7);
        expect(saved.shipment_totals).to.deep.eq(completed.shipment_totals);
        expect(saved.shipment_history).to.eq(completed.shipment_history);
        expect(saved.rendered_work_preview).to.eq('updated preview');
        expect((await Harbors.findOneAsync('test')).lanes.lane.manifest)
          .to.deep.eq({ setting: 'edited' });
        expect((await LatestShipment.findOneAsync('lane')).shipment)
          .to.deep.eq(completed.last_shipment);
      });
  }

  for (const identity of [{}, { _id: 'new-lane' }]) {
    it(`initializes shipment state on creation ${identity._id || ''}`,
      async () => {
        const saved = await upsert({ ...identity, type: 'test',
          custom_setting: 'retained', shipment_count: 900, salvage_runs: 90,
          last_shipment: { active: true }, shipment_history: 900,
          shipment_totals: { shipments: 900, salvage: 90 },
        });
        expect(saved.custom_setting).to.eq('retained');
        expect(saved.shipment_count).to.eq(0);
        expect(saved.salvage_runs).to.eq(0);
        expect(saved.last_shipment).to.eq(undefined);
        expect(saved.shipment_history).to.eq(undefined);
        expect(saved.shipment_totals).to.eq(undefined);

        const edited = await upsert({ ...saved, name: 'Edited',
          'last_shipment.active': true,
          'shipment_totals.shipments': 900,
          'shipment_history.extra': true,
        });
        expect(edited.name).to.eq('Edited');
        expect(edited.last_shipment).to.eq(undefined);
        expect(edited.shipment_totals).to.eq(undefined);
        expect(edited.shipment_history).to.eq(undefined);
      });
  }
});
