import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes/lanes';
import { Users } from '../../../api/users/users';

Template.root.helpers({
  latest_shipment: function () {
    var lanes = Lanes.find({}, { sort: { latest_shipment: -1 } }).fetch();
    var latest_lane = lanes[0];
    var split_date = latest_lane ? latest_lane.latest_shipment.split('-') : '';
    var parsed_date = [];

    _.each(split_date, function (number) {
      parsed_date.push(parseInt(number, 10));
    });

    if (parsed_date.length) {
      return {
        name: latest_lane.name,
        date: latest_lane.latest_shipment,
        locale: new Date(
          parsed_date[0],
          parsed_date[1],
          parsed_date[2],
          parsed_date[3],
          parsed_date[4],
          parsed_date[5],
        ).toLocaleString()
      };
    }
    return {
      name: latest_lane ? latest_lane.name : '',
      date: '',
      locale: 'Never'
    };
  },

  shipments_last_24_hours: function () {
    var yesterday = Date.now() - 86400000;
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
