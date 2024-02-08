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
import { resetDatabase } from 'cleaner';

describe('Shipments', () => {
  beforeEach(() => resetDatabase(null));

  describe('#publish_shipments', () => {
    it('returns a cursor for the publicaton', () => {
      expect(publish_shipments()._cursorDescription.collectionName)
        .to.eq('Shipments');
    });
    it('accepts a Lane as the query', () => {
      const lane = Factory.create('lane', {
        _id: 'test',
        type: 'test',
        date: 'test',
      });
      Factory.create('shipment', { _id: 'test', lane: 'test', start: 'test' });
      expect(publish_shipments(lane).count()).to.eq(1);
    });
    it('accepts an array of Lanes for the query', () => {
      const lanes = [
        Factory.create('lane', { _id: 'test1' }),
        Factory.create('lane', { _id: 'test2' }),
      ];
      Factory.create('shipment', { _id: 'test1', lane: 'test1' });
      Factory.create('shipment', { _id: 'test2', lane: 'test2' });
      expect(publish_shipments(lanes).count()).to.eq(2);
    });
    it('allows lookups via a lane slug', () => {
      Factory.create('lane', { _id: 'test', slug: 'test' });
      Factory.create('shipment', { lane: 'test' });
      expect(publish_shipments({ slug: 'test' }).count()).to.eq(1);
    });
  });

  describe('#get_total_shipments', () => {
    it('returns the total number of shipments in 24 hours', () => {
      Factory.create('shipment');
      Factory.create('shipment', { actual: new Date(Date.now() - 86400000) });
      expect(get_total_shipments()).to.eq(1);
    });
  });

  describe('#last_shipped', () => {
    it('returns the latest shipment for a lane, or in total', () => {
      Factory.create('lane', { _id: 'test1' });
      Factory.create('lane', { _id: 'test2' });
      Factory.create('shipment', {
        _id: 'test1', lane: 'test1', actual: new Date(Date.now()),
      });
      Factory.create('shipment', {
        _id: 'test2', lane: 'test2', actual: new Date(Date.now() + 1),
      });
      expect(last_shipped()._id).to.eq('test2');
      Factory.create('shipment', {
        _id: 'test3', lane: 'test1', actual: new Date(Date.now() + 2),
      });
      expect(last_shipped({ _id: 'test1' })._id).to.eq('test3');
      Factory.create('latest_shipment', {
        _id: 'test1',
        shipment: {
          _id: 'test1',
        },
      });
      expect(last_shipped({ _id: 'test1' })._id).to.eq('test1');
    });
  });

  describe('#total_completed_shipments', () => {
    it('returns the total number of shipments successfully completed', () => {
      expect(total_completed_shipments()).to.eq(0);
      Factory.create('shipment', { lane: 'test', exit_code: 1 });
      Factory.create('shipment', { exit_code: 0 });
      expect(total_completed_shipments()).to.eq(1);
      Factory.create('shipment', { lane: 'test', exit_code: 0 });
      expect(total_completed_shipments({ _id: 'test' })).to.eq(2);
    });
  });

  describe('#total_salvage_runs', () => {
    it('returns the total number of shipments which have failed', () => {
      expect(total_salvage_runs()).to.eq(0);
      Factory.create('shipment', { lane: 'test', exit_code: 0 });
      Factory.create('shipment', { exit_code: 1 });
      expect(total_salvage_runs()).to.eq(1);
      Factory.create('shipment', { lane: 'test', exit_code: 1 });
      expect(total_salvage_runs({ _id: 'test' })).to.eq(2);
    });
  });

  describe('#get_latest_date', () => {
    it('returns an object with locale string for the latest date', () => {
      Factory.create('shipment', { _id: 'test', lane: 'test', finished: 1 });
      Factory.create('lane', { _id: 'test', slug: 'test' });
      Factory.create('lane', { _id: 'test2', name: 'test2', slug: '' });
      expect(get_latest_date().lane).to.eq('test');
      Factory.create('shipment', { _id: 'test2', lane: 'test2', finished: 2 });
      expect(get_latest_date().lane).to.eq('test2');
      Factory.create('shipment', { _id: 'test3', lane: 'test3', finished: 3 });
      expect(typeof get_latest_date().locale).to.eq('string');
    });
    it('returns a information correctly for a lane never shipped', () => {
      expect(get_latest_date().locale).to.eq('never');
    });
  });

  describe('#log_shipment_totals', () => {
    it('should log a number of times equal to (no. of lanes * 2) + 2', () => {
      let count = 0;
      let log = console.log;
      console.log = () => count = count + 1;
      Factory.create('lane', { _id: 'test1' });
      Factory.create('lane', { _id: 'test2' });
      log_shipment_totals();
      expect(count).to.eq(6);
      console.log = log;
    });
  });
});
