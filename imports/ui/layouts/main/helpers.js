import { Template } from 'meteor/templating';
import { Users } from '../../../api/users';

Template.main.onCreated(function () {
  Meteor.subscribe('Users');
  Meteor.subscribe('Lanes');
  Meteor.subscribe('Harbors');
});

Template.main.helpers({
  is_loaded () {
    if (
      ! Session.get('loading')
      && ! Meteor.loggingIn()
    ) return true;

    return false;
  },

  logged_in () {
    return Meteor.user();
  },

  no_harbormasters () {
    var harbormasters = Users.find({ harbormaster: true }).fetch();

    return ! harbormasters.length ? true : false;
  },

  no_users () {
    if (! Users.find().fetch().length) { return true; }
    return false;
  }
});

