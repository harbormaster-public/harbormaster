import { Template } from 'meteor/templating';
import { Users } from '../../../api/users/users';
import { Lanes } from '../../../api/lanes/lanes';

Template.profile.events({
  'change .is-harbormaster' (event) {
    var user_id = FlowRouter.getParam('user_id') ||
      Meteor.user().emails[0].address
    ;
    var user = Users.findOne(user_id);

    user.harbormaster = event.target.checked;

    Users.update(user_id, user);
  },

  'change .can-ply-lane' (event) {
    var lane_id = $(event.target).attr('data-lane-id');
    var user_id = FlowRouter.getParam('user_id');
    var lane = Lanes.findOne(lane_id);

    lane.captains = lane.captains || [];

    if (event.target.checked) {
      lane.captains.push(user_id);
    } else {

      lane.captains = _.reject(lane.captains, function (captain) {
        return captain == user_id;
      });
    }

    Lanes.update(lane_id, lane);
  }
});
