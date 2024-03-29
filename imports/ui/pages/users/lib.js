import { Users } from '../../../api/users';
import { Lanes } from '../../../api/lanes';

const is_harbormaster = function (user) {
  if (!user) user = Users.findOne(H.user()._id);
  if (user?.harbormaster) { return 'Yes'; }

  return 'No';
};

const captain_lanes = function (user) {
  let pliable_lanes = Lanes.find({
    $or: [
      { captains: { $in: [user._id] } },
      { tokens: { $exists: true } },
    ],
  }).fetch();
  let lane_names = [];

  if (user.harbormaster) { return 'All'; }
  _.each(pliable_lanes, function (lane) {
    /* istanbul ignore else */
    if (
      // user webhook assigned
      (lane.tokens && Object.values(lane.tokens).includes(user._id)) ||
      // user is assigned as captain
      !lane.tokens
    ) {
      lane_names.push(lane.name);
    }
  });

  return lane_names.length ? lane_names.join(', ') : 'None';
};

const expire_user = function (user) {
  const confirm_message = `Expire user?\n${user._id}`;

  /* istanbul ignore else */
  if (H.confirm(confirm_message)) {
    H.call('Users#expire_user', user._id, (err, res) => {
      /* istanbul ignore next */
      if (err) throw err;

      /* istanbul ignore next */
      if (!H.isTest) console.log('User expired:', res);
      H.alert(`User expired: ${res}`);
    });
  }
};

export {
  is_harbormaster,
  captain_lanes,
  expire_user,
};
