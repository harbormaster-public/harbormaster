import { Template } from 'meteor/templating';
import { Session } from 'meteor/session';
import { ReactiveVar } from 'meteor/reactive-var';
import { Lanes } from '../../../../api/lanes';
import { Harbors } from '../../../../api/harbors';
import { Shipments } from '../../../../api/shipments';
import { count, history, get_lane } from '../lib/util';
import { moment } from 'meteor/momentjs:moment';

const options = { sort: { actual: -1 }, limit: H.AMOUNT_SHOWN };
const shipment_count = new ReactiveVar();
const not_found = new ReactiveVar(false);
const not_found_text = `
  <p><strong>The harbor you're viewing hasn't been installed for this
    Harbormaster instance.</strong></p>
  <p>Shipping to it has been disabled.  To enable it, the harbor needs to
    be installed in the Harbormaster harbor directory
    (<code>~/.harbormaster/harbors</code> by default).</p>
`;

Template.ship_lane.onCreated(function () {
  this.autorun(() => {
    const name = FlowRouter.getParam('name');
    const lane = get_lane(name);

    if (lane) {
      this.subscribe('Shipments', lane, options);

      shipment_count.set(count(get_lane(FlowRouter.getParam('name'))));
    }
  });
});

Template.ship_lane.helpers({
  count () { return shipment_count.get(); },

  lane () {
    let name = FlowRouter.getParam('name');
    let lane = get_lane(name) || false;

    return lane;
  },

  history () {
    return history(get_lane(FlowRouter.getParam('name')));
  },

  working () {
    let name = FlowRouter.getParam('name');
    let lane = get_lane(name);
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
    return H.AMOUNT_SHOWN;
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
          command: result.command,
        });
      });
    }
    else if (date && (stderr && stderr.length)) {
      _.each(stderr, function (result) {
        results.push({
          result: result.stderr,
          address: result.address,
          command: result.command,
        });
      });
    }

    if (results.length) { return results; }
    return false;
  },

  exit_code () {
    let name = FlowRouter.getParam('name');
    let date = this.start || FlowRouter.getParam('date');
    let lane = get_lane(name);
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
    let lane = get_lane(name) || false;
    let date = FlowRouter.getParam('date');
    let shipment = Shipments.findOne({ start: date, lane: lane._id });

    if (shipment && shipment.active) return 'active';

    return '';
  },

  any_active () {
    let name = FlowRouter.getParam('name');
    let lane = get_lane(name) || false;
    let shipments = Shipments.find({ lane: lane._id, active: true });

    if (shipments.count()) return true;
    return false;
  },

  work_preview () {
    let name = FlowRouter.getParam('name');
    let lane = get_lane(name);

    if (not_found.get()) return not_found_text;

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
        function (err, res) {
          if (err) throw err;
          if (res == 404) return not_found.set(true);

          Lanes.update(lane._id, res);
          return Session.set('lane', res);
        }
      );

      return lane.rendered_work_preview;
    }

    return lane;
  },

  can_ship () {
    return not_found.get() ? 'disabled' : '';
  },

  has_work_output () {
    let name = FlowRouter.getParam('name');
    let lane = get_lane(name);
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
    let lane = get_lane(name);
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
  },

});
