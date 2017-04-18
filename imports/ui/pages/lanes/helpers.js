import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes/lanes.js';
import { Users } from '../../../api/users/users.js';
import { Shipments } from '../../../api/shipments/shipments.js';

const sort_by_length = function (doc1, doc2, key, reverse) {
  let length1 = doc1[key] ? doc1[key].length : 0;
  let length2 = doc2[key] ? doc2[key].length : 0;
  let order = 0;

  if (length1 > length2) order = -1;
  else if (length1 < length2) order = 1;

  if (reverse == -1) { order = -order; }
  return order;
};

Template.lanes.helpers({
  lanes () {
    let lanes;
    let sort_by = Session.get('lanes_table_sort_by');
    let reverse = Session.get('lanes_table_sort_reverse') ? -1 : 1;

    //TODO: modularize
    switch (sort_by) {
      case 'name':
        lanes = Lanes.find({}, { sort: { name: reverse } });
        break;
      case 'captains':
        lanes = Lanes.find({}, { sort: { captains: -reverse } });
        break;
      case 'destinations':
        return []
        lanes = Lanes.find({}, {
          sort: function (lane1, lane2) {
            return sort_by_length(lane1, lane2, 'destinations', reverse);
          }
        })
        break;
      case 'stops':
        return []
        lanes = Lanes.find({}, {
          sort: function (lane1, lane2) {
            let total_lane1_stops = 0;
            let total_lane2_stops = 0;
            let sort_order = 0;

            _.each(lane1.destinations, function (destination) {
              total_lane1_stops += destination.stops.length;
            });

            _.each(lane2.destinations, function (destination) {
              total_lane2_stops += destination.stops.length;
            });

            if (total_lane1_stops > total_lane2_stops) {
              sort_order = -1;
            } else if (total_lane1_stops < total_lane2_stops) {
              sort_order = 1;
            }

            if (reverse == -1) { sort_order = -sort_order; }

            return sort_order;
          }
        });
        break;
      case 'shipped':
        debugger;
        lanes = Lanes.find({}, {
          sort: function (lane1, lane2) {
            let lane1_date = lane1.date_history ? 
              lane1.date_history[lane1.date_history.length - 1].actual :
              0
            ;
            let lane2_date = lane2.date_history ?
              lane2.date_history[lane2.date_history.length - 1].actual :
              0
            ;
            let sort_order = 0;

            if (lane1_date > lane2_date) { sort_order = -1; }
            else if (lane1_date < lane2_date) { sort_order = 1; }

            if (reverse == -1) { sort_order = -sort_order; }
            return sort_order;
          }
        })
        break;
      case 'salvaged':
        break;
      case 'shipments':
        lanes = Lanes.find({}, {
          sort: function (lane1, lane2) {
            return sort_by_length(lane1, lane2, 'date_history', reverse);
          }
        });
        break;
      case 'salvage-runs':
        break;
      default:
        lanes = Lanes.find();
        break;
    }

    return lanes;
  },

  active (header) {
    let active_string = '';

    if (header == Session.get('lanes_table_sort_by')) {
      active_string += 'active';
    }

    if (Session.get('lanes_table_sort_reverse')) {
      active_string += ' reverse';
    }

    return active_string;
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
    if (! this.shipments || ! this.shipments.length) { return 'never'; }

    let last_shipment = this.shipments[this.shipments.length - 1];
    last_shipment = Shipments.findOne(last_shipment);

    return last_shipment && last_shipment.actual ?
      last_shipment.actual.toLocaleString() :
      'never'
    ;
  },

  last_salvaged () {
    if (! this.salvage_runs || ! this.salvage_runs.length) { return 'never'; }

    let last_salvage_run = this.salvage_runs[this.salvage_runs.length - 1];
    last_salvage_shipment = Shipments.findOne({
      start: last_salvage_run,
      lane: this.salvage_plan
    });

    return last_salvage_shipment.finished.toLocaleString()
  },

  total_shipments () {
    return this.shipments && this.shipments.length ?
      this.shipments.length :
      0
    ;
  },

  total_salvage_runs () {
    return this.salvage_runs && this.salvage_runs.length ?
      this.salvage_runs.length :
      0
    ;
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
  },

  current_state () {
    let active_shipments = Shipments.find({
      _id: { $in: this.shipments || [] },
      active: true
    }).fetch();
    let latest_shipment = this.shipments && this.shipments.length ?
      this.shipments[this.shipments.length - 1] :
      false
    ;
    let latest_exit_code;

    latest_shipment = Shipments.findOne(latest_shipment) || false;

    if (
      latest_shipment &&
      typeof latest_shipment.exit_code == 'string' ||
      typeof latest_shipment.exit_code == 'number'
    ) {
      latest_exit_code = latest_shipment.exit_code;
    }

    if (active_shipments.length) return 'active';
    if (latest_exit_code == 0) return 'ready';
    if (latest_exit_code) return 'error';
    return 'new';
  },

  latest_shipment () {
    let latest_shipment = this.shipments && this.shipments.length ?
      this.shipments[this.shipments.length - 1] :
      false
    ;

    latest_shipment = latest_shipment && Shipments.findOne(latest_shipment) ?
      Shipments.findOne(latest_shipment).start :
      ''
    ;

    return latest_shipment;
  },

  followup_name () {
    let followup = Lanes.findOne(this.followup);

    return followup ? followup.name : '';
  },

  salvage_plan_name () {
    let salvage_plan = Lanes.findOne(this.salvage_plan);

    return salvage_plan ? salvage_plan.name : '';
  }
});
