import { Template } from 'meteor/templating';
import { Users } from '../../../api/users';

Template.main.events({
  'click .acknowledge-new-harbormaster' () {
    var user_id = Meteor.user().emails[0].address;
    var user = Users.findOne(user_id);

    user.harbormaster = true;

    Meteor.call('Users#update', user_id, user, (err, res) => {
      if (err) throw err;
      console.log(`User ${user_id} updated: ${res}`);
    });
  },
});
