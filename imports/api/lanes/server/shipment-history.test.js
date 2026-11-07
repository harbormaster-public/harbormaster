import { expect } from 'chai';
import { Lanes } from '..';
import { Shipments, LatestShipment } from '../../shipments';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { gate } from '../../../test-helpers/async';
import { update_shipment_history } from './shipment-state';

describe('Shipment history scheduling', () => {
  beforeEach(async () => {
    await resetDatabase();
    for (const _id of ['lane', 'other']) {
      await Lanes.insertAsync({ _id });
      await Shipments.insertAsync({ _id, lane: _id, active: true,
        actual: new Date(Date.now() - 1000),
      });
    }
  });

  it('refreshes queued history while other lanes proceed', async () => {
    const find = Shipments.findOneAsync;
    const reading = gate();
    let reads = 0;
    let first;
    let second;
    try {
      Shipments.findOneAsync = async (...args) => {
        const saved = await find.apply(Shipments, args);
        if (args[0].lane == 'lane' && ++reads == 1) {
          await reading.wait();
        }
        return saved;
      };
      first = update_shipment_history('lane');
      await reading.reached;
      second = update_shipment_history('lane');
      await update_shipment_history('other');
      expect(reads).to.eq(1);
      await Shipments.insertAsync({ _id: 'new', lane: 'lane', active: false,
        actual: new Date(),
      });
      reading.resume();
      await Promise.all([first, second]);
      expect((await Lanes.findOneAsync('lane')).last_shipment._id).to.eq('new');
      expect((await LatestShipment.findOneAsync('lane')).shipment._id)
        .to.eq('new');
    }
    finally {
      reading.resume();
      await Promise.allSettled([first, second]);
      Shipments.findOneAsync = find;
    }
  });

  it('keeps a failed update visible while allowing the next update to run',
    async () => {
      const update = Lanes.updateAsync;
      let fail = true;
      try {
        Lanes.updateAsync = async (...args) => {
          if (fail) {
            fail = false;
            throw new Error('history unavailable');
          }
          return update.apply(Lanes, args);
        };
        const results = await Promise.allSettled([
          update_shipment_history('lane'), update_shipment_history('lane'),
        ]);
        expect(results[0].status).to.eq('rejected');
        expect(results[0].reason.message).to.eq('history unavailable');
        expect(results[1].status).to.eq('fulfilled');
        expect((await update_shipment_history('lane'))._id).to.eq('lane');
      }
      finally { Lanes.updateAsync = update; }
    });

  it('avoids local CAS conflicts when a lane has a backlog', async () => {
    const update = Lanes.updateAsync;
    let attempts = 0;
    let conflicts = 0;
    try {
      Lanes.updateAsync = async (...args) => {
        attempts++;
        const changed = await update.apply(Lanes, args);
        if (!changed) conflicts++;
        return changed;
      };
      await Promise.all(Array.from({ length: 50 }, () =>
        update_shipment_history('lane')));
      expect(attempts).to.eq(50);
      expect(conflicts).to.eq(0);
    }
    finally { Lanes.updateAsync = update; }
  });
});
