import { Users } from '../../../api/users';
import { Lanes } from '../../../api/lanes';

const get_user_id = function (scope) {
  return scope.$route.params.user_id || H.user().emails[0].address;
};

const handle_change_from_webhook = function (event) {
  var lane_id = $(event.target).attr('data-lane-id');
  var user_id = get_user_id(this);
  let remove_token;
  const {render_lane_list} = this;

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
    if (err) throw err;
    render_lane_list();
  });
};

const handle_change_can_ply = function (event) {
  var lane_id = $(event.target).attr('data-lane-id');
  var user_id = get_user_id(this);
  var lane = Lanes.findOne(lane_id);

  lane.captains = lane.captains || [];

  if (event.target.checked) {
    lane.captains.push(user_id);
  }
  else {
    lane.captains = _.reject(lane.captains, function (captain) {
      return captain == user_id;
    });
  }

  H.call('Lanes#upsert', lane, (err, res) => {
    console.log(`Lane "${lane.name}" updated: ${res}`);
  });
};

const handle_change_is_harbormaster = function (event) {
  var user_id = get_user_id(this);
  var user = Users.findOne(user_id);

  user.harbormaster = event.target.checked;

  return H.call('Users#update', user_id, user, (err, res) => {
    console.log(`User ${user_id} updated: ${res}`);
    return res;
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
  var current_harbormaster = Users.findOne(current_user) ?
    Users.findOne(current_user).harbormaster :
    false
  ;

  if (current_harbormaster) { return false; }

  return user ? ! user.harbormaster : true;
};

const is_captain = function () {
  var user_id = get_user_id(this);
  var user = Users.findOne(user_id);
  var pliable_lanes = user ?
    Lanes.find({ captains: { $in: [user._id] } }).fetch() :
    []
  ;

  return pliable_lanes.length ? true : false;
};

const can_ply = function (lane) {
  var user_id = get_user_id(this);
  var user = Users.findOne(user_id);

  if (user && user.harbormaster) { return true; }
  if (lane.captains) {
    const pliable = _.contains(lane.captains, user_id);

    return pliable;
  }

  return false;
};

const can_change_plying = function () {
  var user_id = get_user_id(this);
  var current_user = H.user().emails[0].address;
  var user = Users.findOne(user_id);
  var current_harbormaster = Users.findOne(current_user) ?
    Users.findOne(current_user).harbormaster :
    false
  ;

  if (user_id == current_user || user && user.harbormaster) { return true; }

  if (current_harbormaster) { return false; }

  if (! user || ! user.harbormaster) { return true; }
};

const can_change_webhook = function () {
  var current_user = H.user().emails[0].address;
  var current_harbormaster = Users.findOne(current_user) ?
    Users.findOne(current_user).harbormaster :
    false
  ;

  return ! current_harbormaster;
};

const webhook_allowed = function (lane) {
  var user_id = get_user_id(this);

  if (! lane?.tokens) { return false; }

  return _.find(lane.tokens, function (tokens) {
    return tokens == user_id;
  });
};

const webhook_token = function (lane) {
  var user_id = get_user_id(this);

  if (! lane?.tokens) { return ''; }

  const token = _.invert(lane.tokens)[user_id];

  return token;
};

export {
  handle_change_from_webhook,
  handle_change_can_ply,
  handle_change_is_harbormaster,
  user_email,
  is_harbormaster,
  not_harbormaster,
  is_captain,
  can_ply,
  can_change_plying,
  can_change_webhook,
  webhook_allowed,
  webhook_token,
};
