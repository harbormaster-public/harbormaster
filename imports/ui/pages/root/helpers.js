import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';
import { Shipments } from '../../../api/shipments';

Template.root.helpers({
  latest_shipment: function () {
    let latest_shipment = Shipments.find().fetch().reverse()[0];
    let latest_lane = latest_shipment ?
      Lanes.findOne(latest_shipment.lane) :
      false
    ;

    if (latest_shipment && latest_lane) {
      return {
        name: latest_lane.name,
        date: latest_shipment.start,
        locale: latest_shipment.finished.toLocaleString()
      };
    }

    return {
      name: latest_lane ? latest_lane.name : '',
      date: '',
      locale: 'Never'
    };
  },

  shipments_last_24_hours: function () {
    var yesterday = new Date(Date.now() - 86400000);
    var shipments = Shipments.find({
      actual: {
        $gte: yesterday
      }
    }).fetch();

    return shipments.length;
  },

  total_lanes: function () {
    return Lanes.find().fetch().length;
  },

  total_users: function () {
    return Users.find().fetch().length;
  },

  total_captains: function () {
    var captains = [];
    var lanes = Lanes.find().fetch();

    _.each(lanes, function (lane) {
      if (lane.captains) {
        captains = captains.concat(lane.captains);
      }
    });
    return _.uniq(captains).length;
  },

  total_harbormasters: function () {
    var harbormasters = Users.find({ harbormaster: true }).fetch();
    return harbormasters.length;
  },

  total_destinations: function () {
    return []
    var total_destinations = 0;
    var lanes = Lanes.find().fetch();

    _.each(lanes, function (lane) {
      total_destinations += lane.destinations.length;
    });

    return total_destinations;
  }
});
