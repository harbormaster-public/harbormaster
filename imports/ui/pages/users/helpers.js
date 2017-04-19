import { Template } from 'meteor/templating';
import { Users } from '../../../api/users';
import { Lanes } from '../../../api/lanes';

Template.users.helpers({
  users () {
    return Users.find().fetch();
  },

  is_harbormaster () {
    if (this.harbormaster) { return 'Yes'; }

    return 'No';
  },

  captain_lanes () {
    var pliable_lanes = Lanes.find({ captains: { $in: [this._id] } }).fetch();
    var lane_names = [];

    if (this.harbormaster) { return 'All'; }
    _.each(pliable_lanes, function (lane) {
      lane_names.push(lane.name);
    });
    return lane_names.length ? lane_names.join(', ') : 'None';
  }
});
