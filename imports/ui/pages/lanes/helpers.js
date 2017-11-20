import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';
import { Shipments } from '../../../api/shipments';

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
          }
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
          }
        });
        break;
      case 'salvage-runs':
        lanes = Lanes.find({}, {
          sort: function (lane1, lane2) {
            let lane1_shipments = Shipments.find({
              lane: lane1._id,
              exit_code: { $ne: 0 }
            }).fetch();
            let lane2_shipments = Shipments.find({
              lane: lane2._id,
              exit_code: { $ne: 0 }
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
          }
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

  last_shipped () {
    let last_shipment = Session.get('latest_shipments') ?
      Session.get('latest_shipments')[this.name] :
      false
    ;

    Meteor.call(
      'Shipments#get_latest_date',
      this.shipments[this.shipments.length -1],
      (err, res) => {
        if (err) throw err;

        let latest_shipments = Session.get('latest_shipments') || {};
        latest_shipments[this.name] = res;

        Session.set('latest_shipments', latest_shipments);
    });

    return last_shipment && last_shipment.actual ?
      last_shipment.actual.toLocaleString() :
      'never'
    ;
  },

  last_salvaged () {
    let salvage_runs = Shipments.find({
      lane: this._id,
      exit_code: { $ne: 0 }
    }).fetch();
    if (! salvage_runs.length) return 'never';

    let last_salvage_run = salvage_runs[salvage_runs.length - 1];

    return last_salvage_run.finished ?
      last_salvage_run.finished.toLocaleString() :
      'never'
    ;
  },

  total_shipments () {
    return this.shipments && this.shipments.length ?
      this.shipments.length :
      0
    ;
  },

  total_salvage_runs () {
    return Shipments.find({
      lane: this._id,
      exit_code: { $ne: 0 }
    }).fetch().length;
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
