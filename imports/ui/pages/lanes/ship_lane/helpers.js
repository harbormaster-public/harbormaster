import { Template } from 'meteor/templating';
import { Lanes } from '../../../../api/lanes';
import { Session } from 'meteor/session';
import { Harbors } from '../../../../api/harbors';
import { Shipments } from '../../../../api/shipments';
import { moment } from 'meteor/momentjs:moment';

const options = { sort: { actual: -1 }, limit: $H.AMOUNT_SHOWN };

Template.ship_lane.onCreated(function () {
  const name = FlowRouter.getParam('name');
  const lane = Lanes.findOne({ name: name });

  Meteor.subscribe('Shipments', lane, options);
  Meteor.subscribe('Shipments#check_state', lane);
});

Template.ship_lane.helpers({
  no_history () {
    return Shipments.find().fetch().length === 0;
  },

  lane (sort_order) {
    let name = FlowRouter.getParam('name');
    let lane = Lanes.findOne({ name: name });
    let has_shipments = lane && lane.shipments && lane.shipments.length ?
      true :
      false
    ;

    Session.set('lane', lane);

    if (sort_order == 'history' && has_shipments) {
      return Shipments.find({ lane: lane._id }, options).fetch();
    } else if (sort_order) return [];

    return lane ? lane : false;
  },

  working () {
    let name = FlowRouter.getParam('name');
    let lane = Lanes.findOne({ name: name });
    return Session.get('working_lanes') && lane ?
      Session.get('working_lanes')[lane._id] :
      false
    ;
  },

  pretty_date (date) {
    if (date) return new Date(date).toLocaleString();

    return 'never';
  },

  shipping_log_amount_shown () {
    return $H.AMOUNT_SHOWN;
  },

  shipment_started () {
    return Session.get('shipment_started');
  },

  results () {
    var date = FlowRouter.getParam('date');
    var stdout = this.stdout_history ?
      _.where(this.stdout_history, { start_date: date }) :
      false
    ;
    var stderr = this.stderr_history ?
      _.where(this.stderr_history, { start_date: date }) :
      false
    ;
    var results = [];

    if (date && (stdout && stdout.length)) {
      _.each(stdout, function (result) {
        results.push({
          result: result.stdout,
          address: result.address,
          command: result.command
        });
      });
    } else if (date && (stderr && stderr.length)) {
      _.each(stderr, function (result) {
        results.push({
          result: result.stderr,
          address: result.address,
          command: result.command
        })
      });
    }

    if (results.length) { return results; }
    return false;
  },

  filter_results_by_address (results, address, command) {
    var matching_command = _.where(results, {
      address: address,
      command: command
    });
    var results = '';

    if (matching_command.length) {
      _.each(matching_command, function (command) {
        results += command.result;
      });

      return results;
    }

    return '';

  },

  exit_code () {
    let name = FlowRouter.getParam('name');
    let date = this.start || FlowRouter.getParam('date');
    let lane = Lanes.findOne({ name: name });
    let shipment = lane ?
      Shipments.findOne({ start: date, lane: lane._id }) :
      false
    ;
    let exit_code = shipment ? shipment.exit_code : false;

    if (date && typeof exit_code == 'number') return exit_code;

    return false;
  },

  active () {
    let name = FlowRouter.getParam('name');
    let lane = Lanes.findOne({ name: name });
    let date = FlowRouter.getParam('date');
    let shipment = Shipments.findOne({ start: date, lane: lane._id });

    if (shipment && shipment.active) return 'active';

    return '';
  },

  any_active () {
    let name = FlowRouter.getParam('name');
    let lane = Lanes.findOne({ name: name });
    let shipments = Shipments.find({ lane: lane._id, active: true });

    if (shipments.count()) return true;
    return false;
  },

  work_preview () {
    let name = FlowRouter.getParam('name');
    let lane = Lanes.findOne({ name: name });

    if (lane) {
      let harbor = Harbors.findOne(lane.type);
      let manifest = harbor && harbor.lanes[lane._id] ?
        harbor.lanes[lane._id].manifest :
        false
      ;

      Meteor.call(
        'Harbors#render_work_preview',
        lane,
        manifest,
        function (err, lane) {
          if (err) throw err;

          Lanes.update(lane._id, lane);
          Session.set('lane', lane);
        }
      );

      return lane.rendered_work_preview;
    }

    return lane;
  },

  has_work_output () {
    let name = FlowRouter.getParam('name');
    let lane = Lanes.findOne({ name: name });
    let date = FlowRouter.getParam('date');
    let shipment;

    if (date) {
      shipment = Shipments.findOne({ lane: lane._id, start: date });
    }

    if (shipment && (shipment.stdout.length || shipment.stderr.length)) {
      return true;
    }

    return false;
  },

  work_output () {
    let name = FlowRouter.getParam('name');
    let lane = Lanes.findOne({ name: name });
    let date = FlowRouter.getParam('date');
    let shipment;

    if (date) {
      shipment = Shipments.findOne({ lane: lane._id, start: date });
    }

    if (shipment && shipment.stdout.length) return shipment.stdout;
    if (shipment && shipment.stderr.length) return shipment.stderr;
    return false;
  },

  duration () {
    return moment.duration(this.finished - this.actual).humanize();
  },

  followup_name (lane) {
    let followup = Lanes.findOne(lane.followup);

    return followup ? followup.name : false;
  },

  salvage_plan_name (lane) {
    let salvage_plan = Lanes.findOne(lane.salvage_plan);

    return salvage_plan ? salvage_plan.name : false;
  },

  shipment_active () {
    if (this.active) return 'warning';

    return '';
  }

});
