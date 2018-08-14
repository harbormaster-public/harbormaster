import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';
import { Shipments } from '../../../api/shipments';
import { ShipmentCount } from '../../../api/shipments';
import { SalvageCount } from '../../../api/shipments';
import { LatestShipment } from '../../../api/shipments';

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
    });

    H.subscribe('ShipmentCount');
    H.subscribe('SalvageCount');
    H.subscribe('LatestShipment');
  });
});

Template.lanes.helpers({
  loading_lanes () {
    let total = Session.get('total_lanes');
    let current = Lanes.find().count();

    if (total !== 0 && ! total || current < total) return true;

    return false;
  },

  empty () {
    return (
      Session.get('total_lanes') === 0 && ! Lanes.find().count()
    );
  },

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
    const latest = LatestShipment.findOne(this._id);
    const start = latest ? latest.shipment.start : '';

    return start;
  },

  last_shipped () {
    const latest = LatestShipment.findOne(this._id);
    const actual = latest ? latest.shipment.actual : 'Loading...';

    return actual.toLocaleString();
  },

  total_shipments () {
    const count = ShipmentCount.findOne(this._id);
    const total = count ? count.count : 'Loading...';

    return total.toLocaleString();
  },

  total_salvage_runs () {
    const count = SalvageCount.findOne(this._id);
    const total = count ? count.count : 'Loading...';

    return total.toLocaleString();
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
    let latest = LatestShipment.findOne(this._id);
    let active_shipments = Shipments.find({
      lane: this._id,
      active: true,
    }).count();

    if (active_shipments) return 'active';

    if (latest && latest.shipment.exit_code) return text_error;
    if (latest && latest.shipment.exit_code == 0) return text_ready;

    return text_na;
  },

  followup_name () {
    let followup = Lanes.findOne(this.followup);

    return followup ? followup.name : '';
  },

  salvage_plan_name () {
    let salvage_plan = Lanes.findOne(this.salvage_plan);

    return salvage_plan ? salvage_plan.name : '';
  },
});
