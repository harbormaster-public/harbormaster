import { Lanes } from '../../../../api/lanes';
import { Users } from '../../../../api/users';
import { Harbors } from '../../../../api/harbors';
import { count, history, get_lane } from '../lib/util';

const not_found = new H.ReactiveVar(false);
const not_found_text = `
    <p><strong>The harbor you're viewing hasn't been installed for this
      Harbormaster instance.</strong></p>
    <p>Editing it has been disabled.  To enable it, the harbor will need to
      be installed in the Harbormaster harbor directory
      (<code>~/.harbormaster/harbors</code> by default).</p>
  `;
const loading_text = 'Loading...';

const update_harbor = function () {
  // Capture the user form values from component-agnostic rendering
  let inputs = H.$('.harbor').find('input, textarea');
  let values = {};
  let $lane = H.Session.get('lane');

  _.each(inputs, function (element) {
    let type = element.type;
    let value = element.value;
    let checked = element.checked;
    let name = element.name;
    /* istanbul ignore else */
    if (!values[name]) {
      values[name] = (type == 'checkbox' || type == 'radio') ?
        (checked && value) || values[name] :
        value
      ;
    }
  });

  values.timestamp = Date.now();

  /* istanbul ignore next reason: no need to test the framework's machinery */
  H.call(
    'Harbors#update',
    $lane,
    values,
    (err, res) => update_harbor_method.bind(this)(err, res),
  );

  return values;
};

const update_harbor_method = function (err, res) {
  let validating_fields = H.Session.get('validating_fields');
  if (err) throw err;

  if (!res.success && validating_fields) H.alert('Invalid values.');
  update_lane(res.lane);
  H.Session.set('validating_fields', false);
  this.harbor_refresh += 1;

  return H.Session.get('lane');
};

const update_lane = ($lane) => {
  return H.call('Lanes#upsert', $lane, (err, updated) => {
    /* istanbul ignore next */
    if (err) throw err;
    /* istanbul ignore next */
    if (!H.isTest) console.log(`Lane "${updated.name}" updated`);

    H.Session.set('lane', updated);
    return updated;
  });
};

const change_lane_name = function (event) {
  let $lane = H.Session.get('lane') || {};
  $lane.name = event.target.value;
  const render_only = Lanes.findOne($lane._id) ? false : true;

  const new_slug = slug($lane, render_only);
  let new_path = `/lanes/${new_slug}/edit`;

  $lane.slug = new_slug;
  if (render_only) H.Session.set('lane', $lane);

  /* istanbul ignore else */
  if (new_path != this.$route.path) this.$router.push(new_path);
};

const slug = function ($lane, render_only) {
  const p = new RegExp(('·/,:;_').split('').join('|'), 'g');

  $lane = $lane && $lane.name && $lane.name != 'new' ?
    $lane :
    get_lane($lane)
  ;

  if ($lane.name) {
    const $slug = $lane.name.toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(p, '-') // Replace special characters with -
      .replace(/&/g, '-and-') // Replace & with 'and'
      .replace(/\-\-+/g, '-') // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start of text
      .replace(/-+$/, '') // Trim - from end of text
      .replace(/\(|\)|\[|\]|\{|\}/g, '')
      ;

    $lane.slug = $slug;
    if (!render_only) {
      update_lane($lane);
    }
    return $slug;

  }

  return '';
};

const followup_lane = function () {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));
  if (!$lane.followup && !$lane.name) return false;

  return $lane.followup?.name || '';
};

const salvage_plan_lane = function () {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));
  if (!$lane.salvage_plan && !$lane.name) return false;

  return $lane.salvage_plan?.name || '';
};

const lanes = function () {
  return Lanes.find({}, { sort: { name: 1 } });
};

const lane = function () {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));

  return $lane;
};

const lane_count = function () {
  return count(get_lane(this.$route?.params?.slug));
};

const shipment_history = function () {
  return history(get_lane(this.$route?.params?.slug));
};

const no_followup = function () {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));

  return Lanes.find().count() < 2 ||
    $lane && $lane.followup ||
    H.Session.get('choose_followup') ||
    false;
};

const no_salvage = function () {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));

  return Lanes.find().count() < 2 ||
    $lane && $lane.salvage_plan ||
    H.Session.get('choose_salvage_plan') ||
    false;
};

const choose_followup = function () {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));

  return H.Session.get('choose_followup') || $lane && $lane.followup;
};

const choose_salvage_plan = function () {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));

  return H.Session.get('choose_salvage_plan') || $lane && $lane.salvage_plan;
};

const can_ply = function (user, $lane) {
  if (user?.harbormaster) return true;
  if ($lane?.captains && $lane?.captains?.length) {
    return $lane.captains.find(captain => user._id == captain) ? true : false;
  }
  return false;
};

const captain_list = function () {
  const $lane = H.Session.get('lane') || {};
  const users = Users.find({ expired: { $not: { $exists: true } } }).fetch();
  const you = Users.findOne(H.userId);
  const captains = users.map(user => ({
    ...user,
    can_ply: can_ply(user, $lane),
    can_set_ply: user.harbormaster || you?.harbormaster,
  }));

  return captains;
};

const plying = function () {
  var $lane = H.Session.get('lane');
  var user = Users.findOne(H.user().emails[0].address);

  if (user && user.harbormaster) { return true; }

  if ($lane?.captains && $lane?.captains?.length) {
    let captain = _.find($lane.captains, function (email) {
      return email == H.user().emails[0].address;
    });

    return captain ? true : false;
  }

  return false;
};

const harbors = function () {
  let $harbors = Harbors.find({ registered: true }).fetch();

  return $harbors;
};

const current_lane = function () {
  let name = this.$route?.params?.slug;
  let $lane = H.Session.get('lane') || get_lane(name);

  return !_.isEmpty($lane) ? $lane : { type: false };
};

const lane_type = function () {
  let name = this.$route?.params?.slug;
  let $lane = H.Session.get('lane') || get_lane(name);

  return $lane && $lane.type;
};

const render_harbor = function () {
  let name = this.$route?.params?.slug;
  let $lane = get_lane(name);
  if (!$lane._id && !$lane.name) return 'Assign a Name first!';
  let harbor = $lane.type ? Harbors.findOne($lane.type) : {};
  let harbor_lane_reference = harbor?.lanes ?
    harbor.lanes[$lane._id] :
    false
    ;
  let manifest = harbor_lane_reference ?
    harbor_lane_reference.manifest :
    false
    ;
  H.call(
    'Harbors#render_input',
    $lane,
    manifest,
    function (err, active_lane) {
      /* istanbul ignore next */
      if (err) throw err;
      /* istanbul ignore next */
      if (active_lane == 404) return not_found.set(true);

      /* istanbul ignore next */
      if (active_lane) return H.Session.set('lane', active_lane);
      return false;
    });

  if (not_found.get()) return not_found_text;
  if ($lane.rendered_input) return $lane.rendered_input;
  else if (harbor.rendered_input) return harbor.rendered_input;

  return loading_text;
};

const validate_done = function () {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));

  return $lane && $lane.minimum_complete;
};

const chosen_followup = function (followup) {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));

  return followup._id && $lane._id ?
    followup.slug == $lane.followup?.slug :
    false
  ;
};

const chosen_salvage_plan = function (salvage_lane) {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));

  return salvage_lane._id && $lane._id ?
    salvage_lane.slug == $lane.salvage_plan?.slug :
    false
  ;
};

const submit_form = function () {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));
  if (!$lane._id && !$lane.name) return false;

  if (
    $lane.name &&
    $lane.name != 'New' &&
    $lane.name != 'new' &&
    $lane.type
  ) {

    $lane.slug = slug($lane, false);
    H.Session.set('lane', $lane);
    H.Session.set('validating_fields', true);

    return update_harbor();
  }

  return $lane;
};

const change_followup_lane = function (event) {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));
  let $followup_lane = Lanes.findOne({ slug: event?.target?.value });

  if (
    $lane.name &&
    $lane.name != 'New' &&
    $lane.type
  ) {
    $lane.followup = $followup_lane ? $followup_lane : null;
    update_lane($lane);
    return $lane;
  }
  return false;
};

const change_salvage_plan = function (event) {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));
  let $salvage_plan_lane = Lanes.findOne({ slug: event?.target?.value });

  if (
    $lane.name &&
    $lane.name != 'New' &&
    $lane.type
  ) {
    $lane.salvage_plan = $salvage_plan_lane ? $salvage_plan_lane : null;
    update_lane($lane);
    return $lane;
  }

  return false;
};

const change_captains = function (event) {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));
  let captains = $lane && $lane.captains ? $lane.captains : [];
  let user = event?.target?.value;

  if (event?.target?.checked) {
    captains.push(user);
  }
  else {
    captains = _.reject(
      captains,
      /* istanbul ignore next */
      function remove_captain (captain) { return captain == user; }
    );
  }

  /* istanbul ignore else */
  if ($lane && Lanes.findOne($lane._id)) {
    $lane.captains = captains;
    update_lane($lane);
  }
};

const back_to_lanes = function () {
  H.Session.set('lane', null);
  return this.$router.push('/lanes');
};

const choose_harbor_type = function (event) {
  let type = H.$(event?.target).attr('data-type');
  let $lane = H.Session.get('lane');
  if (!$lane) return false;

  $lane.type = type;
  slug.bind(this)($lane);

  return true;
};

const get_lane_name = function () {
  var name = this.$route.params.slug;
  var $lane = get_lane(name);
  H.Session.set('lane', $lane);
  return ($lane.name == 'New' || !$lane.name) ? '' : $lane.name;
};

export {
  update_harbor,
  update_harbor_method,
  update_lane,
  change_lane_name,
  slug,
  followup_lane,
  salvage_plan_lane,
  lanes,
  lane,
  lane_count,
  shipment_history,
  no_followup,
  no_salvage,
  choose_followup,
  choose_salvage_plan,
  can_ply,
  captain_list,
  plying,
  harbors,
  current_lane,
  lane_type,
  render_harbor,
  validate_done,
  chosen_followup,
  chosen_salvage_plan,
  submit_form,
  change_followup_lane,
  change_salvage_plan,
  change_captains,
  back_to_lanes,
  choose_harbor_type,
  get_lane_name,
  not_found,
  not_found_text,
  loading_text,
};
