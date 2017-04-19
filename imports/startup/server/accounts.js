import { Users } from '../../api/users';

Accounts.onLogin(function () {
  var user_id = Meteor.user().emails[0].address;
  var harbormaster = Users.find().fetch().length ? false : true;
  harbormaster = Users.findOne(user_id) ?
    Users.findOne(user_id).harbormaster :
    harbormaster
  ;
  Users.upsert(user_id, {
    harbormaster: harbormaster
  });
});
