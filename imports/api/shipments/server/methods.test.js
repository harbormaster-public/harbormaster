import { expect } from 'chai';
import {
  publish_shipments,
  get_total_shipments,
  last_shipped,
  total_completed_shipments,
  total_salvage_runs,
  get_latest_date,
  log_shipment_totals,
} from './methods';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Shipments, LatestShipment } from '..';
import { Lanes } from '../../lanes';

describe('Shipments', () => {
  beforeEach(async () => await resetDatabase());

  describe('#publish_shipments', () => {
    it('returns a cursor for the publicaton', async () => {
      const cursor = await publish_shipments();
      expect(cursor._cursorDescription).to.exist;
      expect(cursor._cursorDescription.collectionName).to.eq('Shipments');
    });
    it('accepts a Lane as the query', async () => {
      const lane = { _id: 'test', type: 'test', date: 'test' };
      await Lanes.insertAsync(lane);
      await Shipments.insertAsync({ _id: 'test', lane: 'test', start: 'test' });
      const cursor = await publish_shipments(lane);
      expect((await cursor.fetchAsync()).length).to.eq(1);
    });
    it('accepts an array of Lanes for the query', async () => {
      const lanes = [ { _id: 'test1' }, { _id: 'test2' } ];
      await Lanes.insertAsync(lanes[0]);
      await Lanes.insertAsync(lanes[1]);
      await Shipments.insertAsync({ _id: 'test1', lane: 'test1' });
      await Shipments.insertAsync({ _id: 'test2', lane: 'test2' });
      const cursor = await publish_shipments(lanes);
      expect((await cursor.fetchAsync()).length).to.eq(2);
    });
    it('allows lookups via a lane slug', async () => {
      await Lanes.insertAsync({ _id: 'test', slug: 'test' });
      await Shipments.insertAsync({ lane: 'test' });
      const cursor = await publish_shipments({ slug: 'test' });
      expect((await cursor.fetchAsync()).length).to.eq(1);
    });
    it('supports lookups via slug + date together', async () => {
      await Lanes.insertAsync({ _id: 'test', slug: 'test' });
      await Shipments.insertAsync({ _id: 'a', lane: 'test', start: 'd1' });
      await Shipments.insertAsync({ _id: 'b', lane: 'other', start: 'd1' });
      const cursor = await publish_shipments({ slug: 'test', date: 'd1' });
      const results = await cursor.fetchAsync();
      expect(results.length).to.eq(1);
      expect(results[0]._id).to.eq('a');
    });
  });

  describe('#get_total_shipments', () => {
    it('returns the total number of shipments in 24 hours', async () => {
      const originalNow = Date.now;
      try {
        const fixedNow = 1700000000000;
        Date.now = () => fixedNow;

        const interval = 86400000;
        const yesterday = new Date(fixedNow - interval);

        await Shipments.insertAsync({ actual: new Date(fixedNow) });
        await Shipments.insertAsync({
          actual: new Date(fixedNow - interval - 1),
        });
        await Shipments.insertAsync({ actual: yesterday });
        expect(await get_total_shipments()).to.eq(2);
      }
      finally {
        Date.now = originalNow;
      }
    });
  });

  describe('#last_shipped', () => {
    it('returns the latest shipment for a lane, or in total', async () => {
      await Lanes.insertAsync({ _id: 'test1' });
      await Lanes.insertAsync({ _id: 'test2' });
      await Shipments.insertAsync({
        _id: 'test1', lane: 'test1', actual: new Date(Date.now()),
      });
      await Shipments.insertAsync({
        _id: 'test2', lane: 'test2', actual: new Date(Date.now() + 1),
      });
      expect((await last_shipped())._id).to.eq('test2');
      await Shipments.insertAsync({
        _id: 'test3', lane: 'test1', actual: new Date(Date.now() + 2),
      });
      expect((await last_shipped({ _id: 'test1' }))._id).to.eq('test3');
      await LatestShipment.insertAsync({
        _id: 'test1',
        shipment: {
          _id: 'test1',
        },
      });
      expect((await last_shipped({ _id: 'test1' }))._id).to.eq('test1');
    });
  });

  describe('#total_completed_shipments', () => {
    it(
      'returns the total number of shipments successfully completed',
      async () => {
        expect(await total_completed_shipments()).to.eq(0);
        await Shipments.insertAsync({ lane: 'test', exit_code: 1 });
        await Shipments.insertAsync({ exit_code: 0 });
        expect(await total_completed_shipments()).to.eq(1);
        await Shipments.insertAsync({ lane: 'test', exit_code: 0 });
        expect(await total_completed_shipments({ _id: 'test' })).to.eq(2);
      },
    );
  });

  describe('#total_salvage_runs', () => {
    it('returns the total number of shipments which have failed', async () => {
      expect(await total_salvage_runs()).to.eq(0);
      await Shipments.insertAsync({ lane: 'test', exit_code: 0 });
      await Shipments.insertAsync({ exit_code: 1 });
      expect(await total_salvage_runs()).to.eq(1);
      await Shipments.insertAsync({ lane: 'test', exit_code: 1 });
      expect(await total_salvage_runs({ _id: 'test' })).to.eq(2);
    });
  });

  describe('#get_latest_date', () => {
    beforeEach(async () => await resetDatabase());
    it('returns an object with locale string for the latest date', async () => {
      await Lanes.insertAsync({ _id: 'test', slug: 'test', name: 'test' });
      await Lanes.insertAsync({ _id: 'test2', name: 'test2', slug: 'test2' });
      await Shipments.insertAsync({ _id: 'test', lane: 'test', finished: 1 });
      const result1 = await get_latest_date();
      expect(result1.lane).to.eq('test');
      await Shipments.insertAsync({ _id: 'test2', lane: 'test2', finished: 2 });
      const result2 = await get_latest_date();
      expect(result2.lane).to.eq('test2');
      await Lanes.insertAsync({ _id: 'test3', name: 'test3', slug: 'test3' });
      await Shipments.insertAsync({ _id: 'test3', lane: 'test3', finished: 3 });
      const result3 = await get_latest_date();
      expect(typeof result3.locale).to.eq('string');
    });
    it('returns a information correctly for a lane never shipped', async () => {
      expect((await get_latest_date()).locale).to.eq('never');
    });
    it('finds lane by slug when shipment references lane by slug', async () => {
      await Lanes.insertAsync({
        _id: 'lane_id',
        slug: 'lane_slug',
        name: 'Lane Name',
      });
      await Shipments.insertAsync({
        _id: 'shipment1',
        lane: 'lane_slug',
        finished: new Date(2),
        start: '2024-01-01',
      });
      const result = await get_latest_date();
      expect(result.lane).to.eq('lane_slug');
    });
    it('finds lane by _id when shipment references lane by _id', async () => {
      await Lanes.insertAsync({
        _id: 'lane_id',
        slug: 'lane_slug',
        name: 'Lane Name',
      });
      await Shipments.insertAsync({
        _id: 'shipment1',
        lane: 'lane_id',
        finished: new Date(2),
        start: '2024-01-01',
      });
      const result = await get_latest_date();
      expect(result.lane).to.eq('lane_slug');
    });
    it('finds lane by name when shipment references lane by name', async () => {
      await Lanes.insertAsync({
        _id: 'lane_id',
        slug: 'lane_slug',
        name: 'Lane Name',
      });
      await Shipments.insertAsync({
        _id: 'shipment1',
        lane: 'Lane Name',
        finished: new Date(2),
        start: '2024-01-01',
      });
      const result = await get_latest_date();
      expect(result.lane).to.eq('lane_slug');
    });
    it('returns orphaned shipment info when lane is not found', async () => {
      await Shipments.insertAsync({
        _id: 'shipment1',
        lane: 'nonexistent_lane',
        finished: new Date(2),
        start: '2024-01-01',
      });
      const result = await get_latest_date();
      expect(result.lane).to.eq('');
      expect(result.date).to.eq('');
      expect(result.locale).to.include('orphaned');
    });

    it('does not throw when latest shipment has no finished date', async () => {
      await Lanes.insertAsync({
        _id: 'lane_id',
        slug: 'lane_slug',
        name: 'Lane',
      });
      await Shipments.insertAsync({
        _id: 'shipment1',
        lane: 'lane_id',
        start: new Date(1),
      });
      const result = await get_latest_date();
      expect(result.lane).to.eq('lane_slug');
      expect(typeof result.locale).to.eq('string');
      expect(result.locale).to.not.eq('');
    });
    it('uses lane name when lane has no slug', async () => {
      await Lanes.insertAsync({
        _id: 'lane_no_slug',
        name: 'Lane Without Slug',
        slug: null,
      });
      await Shipments.insertAsync({
        _id: 'shipment1',
        lane: 'lane_no_slug',
        finished: new Date(2),
        start: '2024-01-01',
      });
      const result = await get_latest_date();
      expect(result.lane).to.eq('Lane Without Slug');
    });
  });

  describe('#log_shipment_totals', () => {
    it(
      'should log a number of times equal to (no. of lanes * 2) + 2',
      async () => {
        let count = 0;
        let log = console.log;
        console.log = () => count = count + 1;
        await Lanes.insertAsync({ _id: 'test1' });
        await Lanes.insertAsync({ _id: 'test2' });
        await log_shipment_totals();
        expect(count).to.eq(6);
        console.log = log;
      },
    );
  });

});
