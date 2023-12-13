import { HTTP } from 'meteor/http';
import { Harbors } from '../../../../api/harbors';
import { Shipments } from '../../../../api/shipments';
import { history, get_lane } from '../lib/util';
import { moment } from 'meteor/momentjs:moment';

const not_found = new H.ReactiveVar(false);
const not_found_text = `
  <p><strong>The harbor you're viewing hasn't been installed for this
    Harbormaster instance.</strong></p>
  <p>Shipping to it has been disabled.  To enable it, the harbor needs to
    be installed in the Harbormaster harbor directory
    (<code>~/.harbormaster/harbors</code> by default).</p>
`;

const lane = function (slug) {
  slug = slug ? slug : this.$route?.params?.slug;
  let $lane = slug ? get_lane(slug) : false;
  return $lane;
};

const active = function () {
  let $lane = get_lane(this.$route.params.slug);
  let date = this.$route.params.date;
  let total = Shipments.find({
    active: true,
    lane: $lane._id,
  }).fetch();

  if (
    total.length == 1 && total[0].start == date
    || $lane.last_shipment?.active
  ) return true;
  return false;
};

// If we're GET for this, it's because we can't use POST due to platform.
// Gmail Android, for example, bans this; iOS treats it as GET anyway.
// 🤷‍♂️
const created = function () {
  const { user_id, token } = this.$route.query;

  if (this.$route.params.date) {
    this.$data.historical = true;
  }

  if (user_id && token) HTTP.post(
    this.$route.fullPath,
    /* istanbul ignore next */
    (err, res) => {
      /* istanbul ignore next */
      if (!err && res) console.log(`Shipment started.`);
    });
};

const exit_code = function () {
  let $lane = get_lane(this.$route.params.slug);
  let date = this.$route.params.date;

  let shipment = $lane._id ?
    Shipments.findOne({ start: date, lane: $lane._id }) :
    false
    ;

  if (!shipment || shipment?.active) return '';

  return shipment.exit_code;
};

const work_preview = function () {
  let shipment;
  let manifest;
  let $lane = get_lane(this.$route.params.slug);
  let harbor = Harbors.findOne($lane.type);
  const edit_lane = `<a href="/lanes/${$lane.name}/edit">Edit this lane</a>`;
  let harbor_not_ready_header = `<h4>This Harbor is not ready`;
  harbor_not_ready_header += `, or otherwise not fully configured.</h4>`;
  let harbor_not_ready_text = `${harbor_not_ready_header}\n`;
  harbor_not_ready_text += `<p>Please ${edit_lane}`;
  harbor_not_ready_text += ` and complete its configuration.</p >`;

  if (not_found.get()) return not_found_text;

  if (this.$route.params.date) {
    shipment = Shipments.findOne({
      lane: $lane._id,
      start: this.$route.params.date,
    });
  }

  if (
    this.$route.params.date && shipment?.rendered_work_preview
  ) return shipment.rendered_work_preview;

  if ($lane && harbor?.lanes && !$lane?.rendered_work_preview) {
    manifest = (
      shipment?.manifest ||
      harbor.lanes[$lane._id]?.manifest
    ) || false;

    H.call(
      'Harbors#render_work_preview',
      $lane,
      manifest,
      /* istanbul ignore next */
      function (err_preview, res_lane) {
        if (err_preview) throw err;
        if (res_lane == 404) return not_found.set(true);

        console.log(`Lane "${lane.name}" updated`);
        return H.Session.set('lane', res_lane);
      }
    );
  }
  return $lane.rendered_work_preview && harbor ?
    $lane.rendered_work_preview :
    harbor_not_ready_text
  ;
};

const has_work_output = function () {
  let $lane = get_lane(this.$route.params.slug);
  let date = this.$route.params.date;
  let shipment = Shipments.findOne({ lane: $lane?._id, start: date });
  let any_shipment = Shipments.findOne({ lane: $lane?._id });

  if (
    shipment && (
      (shipment.stdout && Object.keys(shipment.stdout).length) ||
      (shipment.stderr && Object.keys(shipment.stderr).length) ||
      shipment.exit_code == 0
    ) ||
    any_shipment
  ) {
    return true;
  }

  return false;
};

const work_output = function () {
  let $lane = get_lane(this.$route.params.slug);
  let date = this.$route.params.date;
  let shipment = $lane.last_shipment ?
    $lane.last_shipment :
    Shipments.findOne({
      lane: $lane?._id,
      start: date,
    })
    ;

  return shipment;
};

const shipment_history = function () {
  let shipments = history(
    get_lane(this.$route?.params?.slug),
    H.AMOUNT_SHOWN,
    (this.$data?.skip ? 1 : 0)
  );
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
  let $lane = get_lane(this.$route.params.slug);
  let shipments = Shipments.find({ lane: $lane._id, active: true });

  if (
    shipments.count()
    || $lane.last_shipment?.active
  ) return true;
  return false;
};

const reset_shipment = function () {
  const { date, slug } = this.$route.params;

  H.call(
    'Lanes#reset_shipment',
    slug,
    date,
    /* istanbul ignore next */
    function (err, res) {
      if (err) throw err;
      console.log('Reset shipment response:', res);
    });
};

const reset_all_active = function () {
  const { slug } = this.$route.params;

  H.call(
    'Lanes#reset_all_active_shipments',
    slug,
    /* istanbul ignore next */
    function (err, res) {
      if (err) throw err;
      console.log('Reset all active shipments response:', res);
    });
};

const start_shipment = function () {
  let { $router, $data } = this;
  let working_lanes = H.Session.get('working_lanes') || {};
  let $lane = get_lane(this.$route.params.slug);
  let harbor = Harbors.findOne($lane.type);
  let manifest = harbor.lanes[$lane._id].manifest;
  let shipment_start_date = H.start_date();
  let shipment = Shipments.findOne({
    start: shipment_start_date,
    lane: $lane._id,
  });

  working_lanes[$lane._id] = true;
  H.Session.set('working_lanes', working_lanes);
  /* istanbul ignore else */
  if (!shipment || !shipment.active) {
    /* istanbul ignore next */
    if (!H.isTest) console.log(`Starting shipment for lane: ${$lane.name}`);
    H.call(
      'Lanes#start_shipment',
      $lane._id,
      manifest,
      shipment_start_date,
      (err, res) => {
        if (err) throw err;

        working_lanes = H.Session.get('working_lanes');
        working_lanes[$lane._id] = false;
        H.Session.set('working_lanes', working_lanes);
        /* istanbul ignore next */
        if (!H.isTest) console.log('Shipment started for lane:', $lane.name);
        $router.push(`/lanes/${$lane.slug}/ship/${shipment_start_date}`);
        $data.rerenders = this.$data.rerenders + 1;

        return res;
      }
    );
  }

  return $lane;
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
  has_work_output,
  work_output,
  duration,
  pretty_date,
  start_shipment,
  not_found,
  not_found_text,
};
