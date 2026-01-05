import { Users } from '../../../api/users';
import { Lanes } from '../../../api/lanes';

const is_harbormaster = function (user) {
  if (!user) {
    const userId = H.user()?.emails[0]?.address;
    user = Users.findOne(userId);
  }
  if (user?.harbormaster) { return 'Yes'; }
  return 'No';
};

const captain_lanes = function (user) {
  const lanesCursor = Lanes.find({
    $or: [
      { captains: { $in: [user._id] } },
      { tokens: { $exists: true } },
    ],
  });
  const pliable_lanes = lanesCursor.fetch();
  let lane_names = [];

  if (user.harbormaster) { return 'All'; }
  _.each(pliable_lanes, function (lane) {
    /* istanbul ignore else */
    if (
      (lane.tokens && Object.values(lane.tokens).includes(user._id)) ||
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
