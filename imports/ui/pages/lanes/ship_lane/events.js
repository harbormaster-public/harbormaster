import { Template } from 'meteor/templating';
import { Lanes } from '../../../../api/lanes';
import { Harbors } from '../../../../api/harbors';
import { Shipments } from '../../../../api/shipments';

Template.ship_lane.events({
  'click .start-shipment': function () {
    let working_lanes = Session.get('working_lanes') || {};
    let name = FlowRouter.getParam('name');
    let lane = Lanes.findOne({ name: name });
    let harbor = Harbors.findOne(lane.type);
    let manifest = harbor.lanes[lane._id].manifest;
    let shipment_start_date = $H.start_date();
    let shipment = Shipments.findOne({
      start: shipment_start_date,
      lane: lane._id,
    });

    working_lanes[lane._id] = true;
    Session.set('working_lanes', working_lanes);

    if (! shipment || ! shipment.active) {
      console.log(`Starting shipment for lane: ${lane.name}`);
      Meteor.call(
        'Lanes#start_shipment',
        lane._id,
        manifest,
        shipment_start_date,
        function (err, res) {
          if (err) throw err;

          working_lanes[lane._id] = false;
          Session.set('working_lanes', working_lanes);
          console.log('Shipment started for lane:', lane.name);
          FlowRouter.go('/lanes/' + name + '/ship/' + shipment_start_date);

          return res;
        }
      );
    }

    return lane;
  },

  'click .reset-shipment': function () {
    let name = FlowRouter.getParam('name');
    let date = FlowRouter.getParam('date');

    $H.call('Lanes#reset_shipment', name, date, function (err, res) {
      if (err) throw err;
      console.log('Reset shipment response:', res);
    });
  },

  'click .reset-all-active': function () {
    let name = FlowRouter.getParam('name');

    $H.call('Lanes#reset_all_active_shipments', name, function (err, res) {
      if (err) throw err;
      console.log('Reset all active shipments response:', res);
    });
  },
});
