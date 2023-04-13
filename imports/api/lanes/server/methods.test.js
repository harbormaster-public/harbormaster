import { resetDatabase } from 'meteor/xolvio:cleaner';
import faker from 'faker';
import '.';
import { Lanes } from '..';

var test_lane_id = faker.random.uuid();
var test_start_date = faker.date.recent();
var test_destinations = [];

Factory.define('lane', Lanes, {
  _id: test_lane_id,
  destinations: test_destinations
});

describe('Lanes', function () {
  beforeEach(function () {
    resetDatabase();
  });

  describe('#collect_latest_shipments', () => {
    it('updates Lanes with their last Shipment reference');
    it('records the Shipment in the list of LatestShipments');
  });

  describe('#get_increment', () => {
    it('increments a given lane by 1 based on slug')
  });

  describe('publication', () => {
    it('allows subscription by lane _id');
    it('allows subscription by lane name');
    it('allows subscription by lane slug');
    it('allows subscription to an array of lanes');
    it('allows subscription by Lane object');
  });

  describe('#update_webhook_token', () => {
    it('can remove tokens');
    it('can assign a token to a given user');
  });

  describe('#start_shipment', () => {
    it('starts a shipment');
    it('throws for improper arguments');
    it('updates the LatestShipment collection');
    it("increases  the lane's shipment count");
    it("calls the Harbor's work() method");
    it("catches errors and records them as part of the Shipment manifest");
    it("ends a shipment with exit code 1 on an error");
    it('returns an updated manifest with its results');
  });

  describe('#end_shipment', () => {
    it('throws for improper arguments');
    it('increments salvage runs for a non-zero exit code');
    it('updates a shipment record with results and sets it inactive');
    it('updates a Lane with the last shipment and total salvage runs');
    it('updates the LatestShipment collection');
    it('executes a salvage run if one is specified for non-0 exits');
    it('executes a followup if one is specified upon successful exit');
  });

  describe('#reset_shipment', () => {
    it('sets a given shipment to inactive with exit code 1');
    it("updates the LatestShipment collection and Lane's last shipment");
  })

  describe('#reset_all_Active_shipments', () => {
    it("sets all active shipments for a lane to false with exit code 1");
    it("updates the lane record and LatesShipment collection");
  });

  describe('#update_slug', () => {
    it('returns true when the slug has been updated');
  });

  describe('#delete', () => {
    it('removes the Lane from its collection');
    it('removes the lane from its registered Harbor');
    it('returns the total estimate of Lanes remaning');
  });

  describe('#duplicate', () => {
    it('resets shipment and salvage counts to 0');
    it('increments the lane name and slug properly');
    it('adds the lane to the Lanes collection and the Harbor type');
    it('updates the harbor with the new manifest');
    it('returns a path matching format: /lanes/:slug/edit');
  });
});
