import { Template } from 'meteor/templating';
import { Lanes } from '../../../../api/lanes/lanes.js';

Template.ship_lane.events({
  'click .start-shipment': function (event) {
    var name = FlowRouter.getParam('name');
    var lane = Lanes.findOne({ name: name });
    var date = new Date();
    var shipment_start_date = date.getFullYear() + '-' +
      date.getMonth() + '-' +
      date.getDate() + '-' +
      date.getHours() + '-' +
      date.getMinutes() + '-' +
      date.getSeconds()
    ;
    if (! lane.shipment_active) {
      lane.shipment_active = true;
      lane.latest_shipment = shipment_start_date;
      Lanes.update(lane._id, lane);
      Meteor.call(
        'lanes:start_shipment',
        lane._id,
        shipment_start_date,
        function (err, res) {
          console.log(res);
        }
      );
    }
    FlowRouter.go('/lanes/' + name + '/ship/' + lane.latest_shipment);
  }
});
