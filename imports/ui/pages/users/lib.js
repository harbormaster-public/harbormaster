import { Users } from '../../../api/users';
import { Lanes } from '../../../api/lanes';

const is_harbormaster = function (user) {
  if (!user) user = Users.findOne(H.user()._id);
  if (user?.harbormaster) { return 'Yes'; }

  return 'No';
};

const captain_lanes = function () {
  var pliable_lanes = Lanes.find({ captains: { $in: [this._id] } }).fetch();
  var lane_names = [];

  if (this.harbormaster) { return 'All'; }
  _.each(pliable_lanes, function (lane) {
    lane_names.push(lane.name);
  });
  return lane_names.length ? lane_names.join(', ') : 'None';
};

const expire_user = function (user) {
  const confirm_message = `Expire user?\n${user._id}`;

  if (window.confirm(confirm_message)) {
    H.call('Users#expire_user', user._id, (err, res) => {
      if (err) throw err;
      
      console.log('User expired:', res);
      alert(`User expired: ${res}`);
    });
  }
};

export {
  is_harbormaster,
  captain_lanes,
  expire_user,
}