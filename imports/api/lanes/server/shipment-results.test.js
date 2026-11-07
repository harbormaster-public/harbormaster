import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { patches, rejects as fails } from '../../../test-helpers/async';
import { Lanes } from '..';
import { Shipments, LatestShipment } from '../../shipments';
import { Harbors } from '../../harbors';
import {
  start_shipment, end_shipment, recover_shipments,
} from './methods';

describe('Shipment return receipts', () => {
  const { replace, restore_all } = patches();
  const recover = async () => Promise.all(await recover_shipments());
  const finish = () => end_shipment({ _id: 'parent' }, 0,
    { shipment_id: 'source' });
  let effects;

  const configure_work = (mode) => {
    let returned = false;
    H.harbors.test.work = async (lane, manifest) => {
      effects++;
      if (lane._id == 'salvage') return undefined;
      if (mode == 'synchronous') {
        await H.call('Lanes#end_shipment', lane, 0, manifest);
      }
      if (mode == 'error') return { ...manifest, error: 'failed' };
      returned = true;
      return undefined;
    };
    const call = H.call;
    replace(H, 'call', async (method, ...args) => {
      const result = await call.call(H, method, ...args);
      if (method == 'Lanes#end_shipment' && args[0]._id == 'child') {
        returned = true;
      }
      return result;
    });
    return () => returned;
  };

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
      child: { manifest: { setting: 'original' } },
      salvage: { manifest: {} },
    } });
    await Shipments.insertAsync({ _id: 'source', lane: 'parent',
      active: true, actual: new Date(), stdout: {}, stderr: {},
      manifest: { shipment_id: 'source' },
    });
  });
  afterEach(restore_all);

  ['ordinary', 'synchronous', 'error'].forEach(mode => {
    it(`keeps an undefined ${mode} return through a history failure`,
      async () => {
        const returned = configure_work(mode);
        const upsert = LatestShipment.upsertAsync;
        replace(LatestShipment, 'upsertAsync', async (...args) => {
          if (args[0]._id == 'child' && returned()) {
            throw new Error('history unavailable');
          }
          return upsert.apply(LatestShipment, args);
        });
        await fails(finish, 'history unavailable');
        const child = await Shipments.findOneAsync({ lane: 'child' });
        expect(child.dispatch.pending).to.eq(true);
        expect(child.dispatch.has_result).to.eq(false);
        const completed_effects = effects;
        LatestShipment.upsertAsync = upsert;
        await recover();
        expect(await start_shipment('child', {}, 'later', child._id))
          .to.eq(undefined);
        expect((await Shipments.findOneAsync(child._id)).dispatch)
          .to.deep.eq({ has_result: false });
        expect((await LatestShipment.findOneAsync('child')).shipment.active)
          .to.eq(child.active);
        expect(effects).to.eq(completed_effects);
      });
  });

  ['before', 'after'].forEach(when => {
    it(`recovers ${when} the receipt write is acknowledged`, async () => {
      configure_work('ordinary');
      const update = Shipments.updateAsync;
      replace(Shipments, 'updateAsync', async (...args) => {
        if (args[1].$set?.dispatch?.has_result === false) {
          if (when == 'after') await update.apply(Shipments, args);
          throw new Error('receipt unavailable');
        }
        return update.apply(Shipments, args);
      });
      await fails(() => start_shipment('child', {}, 'planned', 'receipt'),
        'receipt unavailable');
      Shipments.updateAsync = update;
      await recover();
      expect(await start_shipment('child', {}, 'later', 'receipt'))
        .to.eq(undefined);
      expect((await Shipments.findOneAsync('receipt')).dispatch)
        .to.deep.eq({ has_result: false });
      expect(effects).to.eq(1);
    });
  });

  it('does not replace another owner with a return receipt', async () => {
    configure_work('ordinary');
    const update = Shipments.updateAsync;
    replace(Shipments, 'updateAsync', async (...args) => {
      const result = await update.apply(Shipments, args);
      if (args[1].$set?.['dispatch.returned']) {
        await update.call(Shipments, 'lost-receipt', { $set: {
          'dispatch.token': 'replacement',
          'dispatch.until': new Date(Date.now() + 60000),
        } });
      }
      return result;
    });
    await fails(() => start_shipment('child', {}, 'planned', 'lost-receipt'),
      'pending');
    const saved = await Shipments.findOneAsync('lost-receipt');
    expect(saved.dispatch.token).to.eq('replacement');
    expect(saved.dispatch.pending).to.eq(true);
    expect(effects).to.eq(1);
    Shipments.updateAsync = update;
    await Shipments.updateAsync('lost-receipt', {
      $set: { 'dispatch.until': new Date(0) },
    });
    await recover();
    expect((await Shipments.findOneAsync('lost-receipt')).dispatch)
      .to.deep.eq({ has_result: false });
    expect(effects).to.eq(1);
  });

  [true, false].forEach(has_result => {
    it(`cleans inactive dispatch after lane deletion (${has_result})`,
      async () => {
        await Shipments.insertAsync({ _id: 'deleted', lane: 'missing',
          active: false, manifest: { result: 'saved' },
          dispatch: { pending: true, returned: true, has_result },
        });
        await recover();
        const saved = await Shipments.findOneAsync('deleted');
        expect(saved.dispatch.pending).to.eq(undefined);
        expect(saved.dispatch.has_result).to.eq(has_result);
        expect(await start_shipment('missing', {}, 'later', 'deleted'))
          .to.deep.eq(has_result ? { result: 'saved' } : undefined);
        expect(effects).to.eq(0);
      });
  });
});
