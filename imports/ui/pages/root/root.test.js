// import {
  // shipments_last_24_hours,
  // latest_shipment,
  // total_captains,
  // total_harbormasters,
  // total_shipments,
  // is_harbormaster,
  // is_captain,
// } from './lib';

describe('Root Page (/)', () => {

  describe('#shipments_last_24_hours', function () {
    it('returns the total_shipments in locale string');
  });

  describe('#latest_shipment', function () {
    it('returns a loading object if no shipment is available');
    it('gets the latest shipment date and saves it in Session');
    it('returns the latest shipment date from Session');
  });

  describe('#total_captains', function () {
    it('returns the total number of captains across all lanes');
  });

  describe('#total_harbormasters', function () {
    it('returns the total number of current harbormasters');
  });

  describe('#is_harbormaster', function () {
    it('returns true if current the user is a harbormaster');
  });

  describe('#is_captain', function () {
    it('returns true if the user is captain of any lanes');
    it('returns false otherwise');
  });

});
