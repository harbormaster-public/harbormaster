import { resetDatabase } from 'meteor/xolvio:cleaner';
import faker from 'faker';
import './methods';
import { Lanes } from '../lanes';

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

  it('should record start, actual start, and end dates', function () {
    var lane = Factory.create('lane');
    var ran = Meteor.call('Lanes#start_shipment', lane._id, test_start_date);

    lane._id.should.equal(ran._id);
    ran
      .date_history[ran.date_history.length - 1]
      .start_date
      .should
      .be
      .a('date');
    ran
      .date_history[ran.date_history.length - 1]
      .start_date.toString()
      .should
      .equal(test_start_date.toString());
    ran.date_history[ran.date_history.length - 1].actual.should.be.a('date');
    ran.date_history[ran.date_history.length - 1].finished.should.be.a('date');
  });
});
