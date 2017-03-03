import { Template } from 'meteor/templating';
import { Lanes } from '../../../../api/lanes/lanes.js';

Template.ship_lane.events({
  'click .start-shipment': function () {
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
        'Lanes#start_shipment',
        lane._id,
        shipment_start_date,
        function (err, res) {
          if (err) throw err;
          console.log('Shipment started for lane:', res.name);
        }
      );
    }
    FlowRouter.go('/lanes/' + name + '/ship/' + lane.latest_shipment);
  },

  'click .abort-shipment': function () {
    let name = FlowRouter.getParam('name');

    Meteor.call('Lanes#abort_shipment', name, function (err, res) {
      if (err) throw err;
      console.log('Aborted shipment response:', res);
    });
  }
});
