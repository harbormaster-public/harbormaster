import { Users } from '../../../api/users';
import { Lanes } from '../../../api/lanes';

const get_user_id = function (scope) {
  return scope?.$route?.params?.user_id || H.user().emails[0].address;
};

const handle_change_from_webhook = function (event) {
  var lane_id = H.$(event.target).attr('data-lane-id');
  var user_id = get_user_id(this);
  let remove_token;
  const { render_lane_list } = this;

  if (event.target.checked) {
    remove_token = false;
  }
  else {
    remove_token = true;
  }

  H.call(
    'Lanes#update_webhook_token',
    lane_id, user_id, remove_token,
    function (err) {
      /* istanbul ignore next */
      if (err) throw err;
      render_lane_list();
    });
};

const handle_change_can_ply = async function (event) {
  var lane_id = H.$(event.target).attr('data-lane-id');
  var user_id = get_user_id(this);
  var lane = await Lanes.findOneAsync(lane_id);
  if (!lane) return;
  lane.captains = lane.captains || [];

  if (event.target.checked) {
    lane.captains.push(user_id);
  }
  else {
    lane.captains = _.reject(
      lane.captains,
      /* istanbul ignore next */
      function (captain) {
        return captain == user_id;
      });
  }
  H.call(
    'Lanes#upsert',
    lane,
    /* istanbul ignore next */
    (err, res) => {
      console.log(`Lane "${lane.name}" updated: ${res}`);
    });
};

const handle_change_is_harbormaster = async function (event) {
  var user_id = get_user_id(this);
  var user = await Users.findOneAsync(user_id);

  user.harbormaster = event.target.checked;

  H.call(
    'Users#update',
    user_id, user,
    /* istanbul ignore next */
    (err, res) => {
      console.log(`User ${user_id} updated: ${res}`);
    });
};

const user_email = function () {
  var user_id = get_user_id(this);
  var user = Users.findOne(user_id);

  return user ? user._id : '';
};

const is_harbormaster = function () {
  var user_id = get_user_id(this);
  var user = Users.findOne(user_id);

  return user ? user.harbormaster : '';
};

const not_harbormaster = function () {
  var user_id = get_user_id(this);
  var current_user = H.user().emails[0].address;
  var user = Users.findOne(user_id);
  var current_user_doc = Users.findOne(current_user);
  var current_harbormaster = current_user_doc && current_user_doc.harbormaster ?
    current_user_doc.harbormaster :
    false
    ;

  if (current_harbormaster) { return false; }

  return user && !user.harbormaster;
};

const is_captain = function () {
  var user_id = get_user_id(this);
  var user = Users.findOne(user_id);
  var pliable_lanes = user && (
    Lanes.find({ captains: { $in: [user._id] } }).fetch()
  );

  return pliable_lanes.length ? true : false;
};

const can_ply = function (lane) {
  var user_id = get_user_id(this);
  var user = Users.findOne(user_id);

  if (user && user.harbormaster) { return true; }
  if (lane?.captains) {
    const pliable = _.contains(lane.captains, user_id);

    return pliable;
  }

  return false;
};

const is_changing_plying_disabled = function () {
  let user_id = get_user_id(this);
  // TODO: abstract these to a helper function
  let current_user_id = H.user().emails[0].address;
  let user = Users.findOne(user_id);
  let current_user = Users.findOne(current_user_id);
  let current_harbormaster = current_user ?
    current_user.harbormaster :
    false
  ;

  if (user_id == current_user_id || user && user.harbormaster) { return true; }

  if (current_harbormaster) { return false; }

  return true;
};

const can_change_webhook = function () {
  var current_user_id = H.user().emails[0].address;
  var current_user = Users.findOne(current_user_id);
  return !!current_user?.harbormaster;
};

const webhook_allowed = function (lane) {
  var user_id = get_user_id(this);

  if (!lane?.tokens) { return false; }

  return _.find(Object.keys(lane.tokens), function (token) {
    return lane.tokens[token] == user_id;
  });
};

const webhook_token = function (lane) {
  var user_id = get_user_id(this);
  if (!lane?.tokens) { return ''; }

  const token = _.invert(lane.tokens)[user_id];

  return token;
};

export {
  get_user_id,
  handle_change_from_webhook,
  handle_change_can_ply,
  handle_change_is_harbormaster,
  user_email,
  is_harbormaster,
  not_harbormaster,
  is_captain,
  can_ply,
  is_changing_plying_disabled,
  can_change_webhook,
  webhook_allowed,
  webhook_token,
};
