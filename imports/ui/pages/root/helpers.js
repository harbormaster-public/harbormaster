import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';
import { Shipments } from '../../../api/shipments';

let total_shipments = new ReactiveVar('Loading');

Template.root.onCreated(function () {
  this.autorun(() => {
    Meteor.call('Shipments#get_total', (err, res) => {
      if (err) throw err;

      total_shipments.set(res);
    });
  });
});

Template.root.helpers({
  latest_shipment: function () {
    let latest_shipment = Session.get('latest_shipment') || false;

    Meteor.call('Shipments#get_latest_date', function (err, res) {
      if (err) throw err;

      Session.set('latest_shipment', res);
    });

    if (! latest_shipment) return { locale: 'loading...' };

    return Session.get('latest_shipment');
  },

  shipments_last_24_hours: function () {
    return total_shipments.get();
  },

  total_lanes: function () {
    return Lanes.find().count();
  },

  total_users: function () {
    return Users.find().count();
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
