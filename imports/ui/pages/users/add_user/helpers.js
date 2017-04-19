import { Template } from 'meteor/templating';
import { Users } from '../../../../api/users';

Template.add_user.helpers({
  is_harbormaster () {
    var user_id = Meteor.user() ? Meteor.user().emails[0].address: '';
    var user = Users.findOne(user_id);

    if (user && user.harbormaster) { return true; }

    return false;
  }
})
