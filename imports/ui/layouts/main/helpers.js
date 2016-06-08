import { Template } from 'meteor/templating';
import { Users } from '../../../api/users/users';

Template.main.helpers({
  logged_in: function () {
    return Meteor.user();
  },

  no_harbormasters () {
    var harbormasters = Users.find({ harbormaster: true }).fetch();

    return ! harbormasters.length ? true : false;
  },

  no_users () {
    if (! Meteor.users.find().fetch().length) { return true; }
    return false;
  }
});

