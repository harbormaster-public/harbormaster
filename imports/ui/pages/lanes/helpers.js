import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes/lanes.js';
import { Users } from '../../../api/users/users.js';

Template.lanes.helpers({
  lanes () {
    return Lanes.find();
  },

  total_captains () {
    if (! this.captains) {
      return 0;
    }

    return this.captains.length;
  },

  total_stops () {
    var stops = 0;

    _.each(this.destinations, function (destination) {
      stops += destination.stops.length;
    });

    return stops;
  },

  last_shipped () {
    var last_shipped_parsed;
    var last_shipped_date;

    if (! this.latest_shipment) { return 'never'; }
    last_shipped_parsed = this.latest_shipment.split('-');
    last_shipped_date = new Date(
      last_shipped_parsed[0],
      last_shipped_parsed[1],
      last_shipped_parsed[2],
      last_shipped_parsed[3],
      last_shipped_parsed[4],
      last_shipped_parsed[5]
    );
    return last_shipped_date.toLocaleString();
  },

  last_salvage_run () {
    if (! this.latest_salvage_run) { return 'never'; }

    return new Date(this.latest_salvage_run).toLocaleString();
  },

  total_shipments () {
    if (! this.date_history) { return 0; }

    return this.date_history.length;
  },

  salvage_plans () {
    if (! this.salvage_plans) { return 0; }

    return this.salvage_plans.length;
  },

  can_ply () {
    var user = Users.findOne(Meteor.user().emails[0].address);
    if (user && user.harbormaster) {
      return true;
    }

    if (this.captains && this.captains.length) {
      let captain = _.find(this.captains, function (email) {
        return email == Meteor.user().emails[0].address;
      });

      return captain ? true : false;
    }

    return false;
  }
});
