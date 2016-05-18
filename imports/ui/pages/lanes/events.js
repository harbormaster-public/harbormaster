import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes/lanes.js';

Template.lanes.events({
  'click #new-lane': function () {
    Lanes.insert({
      name: 'foo', // User input
      destinations: ['a', 'b'], // Pull from corresponding collection
      stops: 5, // Pull from corresponding collection
      captains: 2, // Pull from corresponding collection
      last_shipped: new Date(), // Pull from collection
      total_shipments: 80,
      salvage_plans: 1, // Pull from corresponding collection
      last_salvage_run: new Date()
    });
  }
});
