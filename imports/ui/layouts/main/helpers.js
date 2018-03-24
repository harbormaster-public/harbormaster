import { Template } from 'meteor/templating';
import { Users } from '../../../api/users';

let users_subscription;
let lanes_subscription;
let harbors_subscription;
let shipments_subscription;

Template.main.onCreated(function () {
  users_subscription = Meteor.subscribe('Users');
  lanes_subscription = Meteor.subscribe('Lanes');
  harbors_subscription = Meteor.subscribe('Harbors');
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

