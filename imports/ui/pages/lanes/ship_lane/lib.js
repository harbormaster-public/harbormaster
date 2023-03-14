import { Session } from 'meteor/session';
import { ReactiveVar } from 'meteor/reactive-var';
import { HTTP } from 'meteor/http';
import { Harbors } from '../../../../api/harbors';
import { Shipments } from '../../../../api/shipments';
import { history, get_lane } from '../lib/util';
import { moment } from 'meteor/momentjs:moment';

const not_found = new ReactiveVar(false);
//TODO: Holdover from Blaze.  Componentize
const not_found_text = `
  <p><strong>The harbor you're viewing hasn't been installed for this
    Harbormaster instance.</strong></p>
  <p>Shipping to it has been disabled.  To enable it, the harbor needs to
    be installed in the Harbormaster harbor directory
    (<code>~/.harbormaster/harbors</code> by default).</p>
`;

const lane = function () {
  let lane = get_lane(this.$route.params.slug) || false;
  return lane;
};

const active = function () {
  let lane = get_lane(this.$route.params.slug) || {};
  let date = this.$route.params.date;
  let total = Shipments.find({
    active: true, 
    lane: lane._id,
  }).fetch();

  if (total.length == 1 && total[0].start == date) return true;
  else return false;
};

// If we're GET for this, it's because we can't use POST due to platform
// Gmail Android, for example, bans this; iOS treats it as GET anyway
// 🤷‍♂️
const created = function () {
  const { user_id, token } = this.$route.query;
  
  if (this.$route.params.date) {
    this.$data.historical = true;
  }

  if (user_id && token) HTTP.post(this.$route.fullPath, (err, res) => {
    if (!err) console.log(`Shipment started.`);
  });
};

const exit_code = function () {
  let lane = get_lane(this.$route.params.slug) || {};
  let date = this.$route.params.date;
  
  let shipment = lane ?
    Shipments.findOne({ start: date, lane: lane._id }) :
    false
  ;
  let exit_code = shipment ? shipment.exit_code : '';

  return exit_code;
};

const work_preview = function () {
  let lane = get_lane(this.$route.params.slug);
  let harbor = Harbors.findOne(lane?.type);
  let shipment;
  let manifest;
  const harbor_not_ready_text = `
    <h4>This Harbor is not ready, or otherwise not fully configured.</h4>
    <p>Please "<a href="/lanes/${lane?.name}/edit">Edit this lane</a>" and complete its configuration.</p>
  `;

  if (not_found.get()) return not_found_text;

  if (this.$route.params.date) {
    shipment = Shipments.findOne({
      lane: lane._id,
      start: this.$route.params.date,
    });
  }

  if (
    this.$route.params.date && shipment?.rendered_work_preview
  ) return shipment.rendered_work_preview;

  if (lane && harbor?.lanes && !lane?.rendered_work_preview) {
    manifest = (
      shipment?.manifest || 
      harbor.lanes[lane._id]?.manifest
      ) || false;
      
    debugger
    H.call(
      'Harbors#render_work_preview',
      lane,
      manifest,
      function (err_preview, res_lane) {
        if (err_preview) throw err;
        if (res_lane == 404) return not_found.set(true);

        return H.call('Lanes#upsert', lane, (err_update, res_success) => {
          if (err_update) throw err_update;
          console.log(`Lane "${lane.name}" updated: ${res_success}`);
          return Session.set('lane', res_lane);
        });
      }
    );
  }

  return lane.rendered_work_preview ? 
    lane.rendered_work_preview : 
    harbor_not_ready_text
  ;
};

const has_work_output = function () {
  let lane = get_lane(this.$route.params.slug);
  let date = this.$route.params.date;
  let shipment = Shipments.findOne({ lane: lane?._id, start: date });
  let any_shipment = Shipments.findOne({ lane: lane?._id });

  if (
    shipment && (
      Object.keys(shipment.stdout).length || 
      Object.keys(shipment.stderr).length || 
      shipment.exit_code == 0
      ) ||
    any_shipment
  ) {
    return true;
  }

  return false;
};

const work_output = function () {
  let lane = get_lane(this.$route.params.slug);
  let date = this.$route.params.date;
  let shipment = lane.latest_shipment ? 
    lane.latest_shipment :
    Shipments.findOne({ 
      lane: lane?._id, 
      start: date,
    })
  ;
  
  return shipment;
};

const shipment_history = function () {
  let shipments = history(get_lane(this.$route.params.slug), H.AMOUNT_SHOWN);
  return shipments;
};

const pretty_date = function (date) {
  if (date) return new Date(date).toLocaleString();

  return 'never';
};

const duration = function (shipment) {
  return moment.duration(shipment.finished - shipment.actual).humanize();
};

const any_active = function () {
  let lane = get_lane(this.$route.params.slug) || false;
  let shipments = Shipments.find({ lane: lane._id, active: true });

  if (shipments.count()) return true;
  return false;
};

const reset_shipment = function () {
  const { date, slug } = this.$route.params;

  H.call('Lanes#reset_shipment', slug, date, function (err, res) {
    if (err) throw err;
    console.log('Reset shipment response:', res);
  });
};

const reset_all_active = function () {
  const {slug} = this.$route.params;
  
  H.call('Lanes#reset_all_active_shipments', slug, function (err, res) {
    if (err) throw err;
    console.log('Reset all active shipments response:', res);
  });
};

const start_shipment = function () {
  let { $router } = this;
  let working_lanes = Session.get('working_lanes') || {};
  let lane = get_lane(this.$route.params.slug);
  let harbor = Harbors.findOne(lane.type);
  let manifest = harbor.lanes[lane._id].manifest;
  let shipment_start_date = H.start_date();
  let shipment = Shipments.findOne({
    start: shipment_start_date,
    lane: lane._id,
  });

  working_lanes[lane._id] = true;
  Session.set('working_lanes', working_lanes);
  if (! shipment || ! shipment.active) {
    console.log(`Starting shipment for lane: ${lane.name}`);
    Meteor.call(
      'Lanes#start_shipment',
      lane._id,
      manifest,
      shipment_start_date,
      function (err, res) {
        if (err) throw err;

        working_lanes = Session.get('working_lanes');
        working_lanes[lane._id] = false;
        Session.set('working_lanes', working_lanes);
        console.log('Shipment started for lane:', lane.name);
        $router.push('/lanes/'+lane.slug+'/ship/'+shipment_start_date);

        return res;
      }
    );
  }

  return lane;
};

export {
  lane,
  work_preview,
  active,
  created,
  exit_code,
  shipment_history,
  any_active,
  reset_all_active,
  reset_shipment,
  salvage_plan_name,
  followup_name,
  has_work_output,
  work_output,
  duration,
  pretty_date,
  start_shipment,
}