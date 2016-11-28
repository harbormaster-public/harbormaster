import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes/lanes';
import { Users } from '../../../api/users/users';

Template.root.helpers({
  latest_shipment: function () {
    var lanes = Lanes.find({}, {
      sort: function (lane1, lane2) {
        let latest_lane1_shipment = lane1.date_history ?
          lane1.date_history[lane1.date_history.length - 1] :
          0;
        let latest_lane2_shipment = lane2.date_history ?
          lane2.date_history[lane2.date_history.length - 1] :
          0;

        if (latest_lane1_shipment > latest_lane2_shipment) { return -1; }
        else if (latest_lane1_shipment < latest_lane2_shipment) { return 1; }
        return 0;
      }
    }).fetch();
    var latest_lane = lanes[lanes.length - 1];

    if (latest_lane.date_history.length) {
      return {
        name: latest_lane.name,
        date: latest_lane.latest_shipment,
        locale: latest_lane
          .date_history[latest_lane.date_history.length - 1]
          .actual
          .toLocaleString()
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
    var lanes = Lanes.find({
      date_history: {
        $elemMatch: {
          actual: {
            $gte: yesterday
          }
        }
      }
    }).fetch();
    var shipments_made = 0;

    _.each(lanes, function (lane) {
      _.each(lane.date_history, function (date) {
        if (date.actual >= yesterday) { shipments_made++; }
      });
    });

    return shipments_made;
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
    var total_destinations = 0;
    var lanes = Lanes.find().fetch();

    _.each(lanes, function (lane) {
      total_destinations += lane.destinations.length;
    });

    return total_destinations;
  }
});
