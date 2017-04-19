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

describe('Lanes#start_shipment', function () {
  beforeEach(function () {
    resetDatabase();
  });

});
