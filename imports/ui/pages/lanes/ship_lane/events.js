import { Template } from 'meteor/templating';
import { Lanes } from '../../../../api/lanes/lanes.js';

Template.ship_lane.events({
  'click .start-shipment': function (event) {
    var name = FlowRouter.getParam('name');
    var lane = Lanes.findOne({ name: name });
    Meteor.call(
      'lanes:start_shipment',
      lane._id,
      function (err, res) {
        //debugger;
      }
    );
  }
});
