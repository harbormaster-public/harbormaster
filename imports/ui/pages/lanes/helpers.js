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
    var last_shipped_parsed;
    var last_shipped_date;

    if (! this.shipments || ! this.shipments.length) { return 'never'; }

    let last_shipment = this.shipments[this.shipments.length - 1];
    last_shipment = Shipments.findOne(last_shipment);

    last_shipped_parsed = last_shipment.start.split('-');
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
    return this.shipments && this.shipments.length ?
      this.shipments.length :
      0
    ;
  },

  salvage_plans () {
    if (! this.salvage_plans) { return 0; }

    return Object.keys(this.salvage_plans).length;
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
    let shipment_active = this.shipment_active;
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

    if (shipment_active) return 'active';
    if (latest_exit_code == 0) return 'ready';
    if (latest_exit_code) return 'error';
    return 'new';
  },

  latest_shipment () {
    let latest_shipment = this.shipments && this.shipments.length ?
      this.shipments[this.shipments.length - 1] :
      false
    ;

    latest_shipment = latest_shipment ?
      Shipments.findOne(latest_shipment).start :
      ''
    ;

    return latest_shipment;
  }
});
