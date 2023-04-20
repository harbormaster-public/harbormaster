import '.';
// import {Shipments} from '..';
// import {
//   publish_shipments,
//   get_total_shipments,
//   last_shipped,
//   total_completed_shipments,
//   total_salvage_runs,
//   get_latest_date,
//   log_shipment_totals,
// } from './methods';

describe('Shipments', () => {
  describe('#publish_shipments', () => {
    it('returns a cursor for the publicaton');
    it('accepts a Lane as the query');
    it('accepts an array of Lanes for the query');
    it('allows lookups via a lane slug');
  });

  describe('#get_total_shipments', () => {
    it('returns the total number of shipments in 24 hours');
  });

  describe('#last_shipped', () => {
    it('returns the latest shipment for a lane, or in total');
    it('is non-blocking');
  });

  describe('#total_completed_shipments', () => {
    it('returns the total number of shipments successfully completed');
    it('is non-blocking');
  });

  describe('#total_salvage_runs', () => {
    it('returns the total number of shipments which have failed');
    it('is non-blocking');
  });

  describe('#get_latest_date', () => {
    it('is non-blocking');
    it('returns a string containing the latest shipment date');
    it('returns a information correctly for a lane never shipped');
  });

  describe('#log_shipment_totals', () => {
    it('should log a number of times equal to ((number of lanes) * 2) + 2');
  });
});
