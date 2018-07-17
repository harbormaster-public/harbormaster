import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';
import { Shipments } from '../../../api/shipments';

const Counts = new Mongo.Collection('counts');

Template.lanes.onCreated(function () {
  let options = {
    sort: { actual: -1 },
    limit: 1,
  };

  Meteor.call('Lanes#get_total', (err, res) => {
    if (err) throw err;

    Session.set('total_lanes', res);
  });


  this.autorun(() => {
    Lanes.find().forEach((lane) => {
      Meteor.subscribe('Shipments', lane, options);
      Meteor.subscribe('ShipmentCount', lane);
      let shipments = Counts.findOne(lane._id);
      console.log(`${lane.name}: ${shipments && shipments.count}`);
    });
  });
});

Template.lanes.helpers({
  loading_lanes () {
    let total = Session.get('total_lanes');
    let current = Lanes.find().count();

    if (total !== 0 && ! total || current < total) return true;

    return false;
  },

  empty () { return Session.get('total_lanes') === 0; },

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
      case 'type':
        lanes = Lanes.find({}, { sort: { type: reverse } });
        break;
      case 'shipped':
        lanes = Lanes.find({}, {
          sort: function (lane1, lane2) {
            let lane1_shipments = Shipments.find({ lane: lane1._id }).fetch();
            let lane2_shipments = Shipments.find({ lane: lane2._id }).fetch();

            let lane1_date = lane1_shipments.length ?
              lane1_shipments[lane1_shipments.length - 1].actual :
              0
            ;
            let lane2_date = lane2_shipments.length ?
              lane2_shipments[lane2_shipments.length - 1].actual :
              0
            ;
            let sort_order = 0;

            if (lane1_date > lane2_date) { sort_order = -1; }
            else if (lane1_date < lane2_date) { sort_order = 1; }

            if (reverse == -1) { sort_order = -sort_order; }
            return sort_order;
          },
        });
        break;
      case 'shipments':
        lanes = Lanes.find({}, {
          sort: function (lane1, lane2) {
            let lane1_shipments = Shipments.find({ lane: lane1._id }).fetch();
            let lane2_shipments = Shipments.find({ lane: lane2._id }).fetch();
            let sort_order = 0;

            if (lane1_shipments.length > lane2_shipments.length) {
              sort_order = -1;
            }
            else if (lane1_shipments.length < lane2_shipments.length) {
             sort_order = 1;
            }

            if (reverse == -1) { sort_order = -sort_order; }
            return sort_order;
          },
        });
        break;
      case 'salvage-runs':
        lanes = Lanes.find({}, {
          sort: function (lane1, lane2) {
            let lane1_shipments = Shipments.find({
              lane: lane1._id,
              exit_code: { $ne: 0 },
            }).fetch();
            let lane2_shipments = Shipments.find({
              lane: lane2._id,
              exit_code: { $ne: 0 },
            }).fetch();
            let sort_order = 0;

            if (lane1_shipments.length > lane2_shipments.length) {
              sort_order = -1;
            }
            else if (lane1_shipments.length < lane2_shipments.length) {
             sort_order = 1;
            }

            if (reverse == -1) { sort_order = -sort_order; }
            return sort_order;
          },
        });
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

  latest_shipment () {
    let last = Session.get(`last_shipped:${this._id}`);
    return last ? last.start : '';
  },

  last_shipped () {
    const never = 'Never';
    let key = `last_shipped:${this._id}`;
    let last = Session.get(key);
    let shipment = Shipments.find({ lane: this._id }, {
      sort: { actual: -1 },
      limit: 1,
    }).fetch()[0];

    H.call('Shipments#last_shipped', this, (err, last_shipment) => {
      if (err) throw err;
      if (! shipment) shipment = never;
      Session.set(key, last_shipment);
    });

    if (shipment && shipment != last) Session.set(key, shipment);
    if (last == never) return never;
    if (last) return last.actual.toLocaleString();
    return 'Loading...';
  },

  total_shipments () {
    let key = `total_completed_shipments:${this._id}`;
    let total_shipments = Session.get(key);

    H.call('Shipments#total_completed_shipments', this, (err, total) => {
      if (err) throw err;
      if (total_shipments != total) Session.set(key, total);
    });

    return total_shipments || 'Loading...';
  },

  total_salvage_runs () {
    let key = `total_salvage_runs:${this._id}`;
    let total_salvage = Session.get(key);

    H.call('Shipments#total_salvage_runs', this, (err, total) => {
      if (err) throw err;
      if (total_salvage != total) Session.set(key, total);
    });

    return total_salvage || 'Loading...';
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
    const text_na = 'N/A';
    const text_error = 'error';
    const text_ready = 'ready';
    let latest_shipment = Session.get(`last_shipped:${this._id}`);
    let active_shipments = Shipments.find({
      lane: this._id,
      active: true,
    }).count();

    if (active_shipments) return 'active';

    if (! latest_shipment) return text_na;
    if (latest_shipment.exit_code) return text_error;
    if (latest_shipment.exit_code == 0) return text_ready;

    return text_na;
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
