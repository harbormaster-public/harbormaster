import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';

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

      res.locale = res.locale != 'never' ?
        new Date(res.locale).toLocaleString() :
        res.locale
      ;
      Session.set('latest_shipment', res);
    });

    if (! latest_shipment) return { locale: 'loading...' };

    return Session.get('latest_shipment');
  },

  shipments_last_24_hours: function () {
    return total_shipments.get().toLocaleString();
  },

  total_lanes: function () {
    return Lanes.find().count().toLocaleString();
  },

  total_users: function () {
    return Users.find().count().toLocaleString();
  },

  total_captains: function () {
    var captains = [];
    var lanes = Lanes.find().fetch();

    _.each(lanes, function (lane) {
      if (lane.captains) {
        captains = captains.concat(lane.captains);
      }
    });
    return _.uniq(captains).length.toLocaleString();
  },

  total_harbormasters: function () {
    var harbormasters = Users.find({ harbormaster: true }).fetch();
    return harbormasters.length.toLocaleString();
  },
});
