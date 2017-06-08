import { Template } from 'meteor/templating';
import { Users } from '../../../api/users';

let users_subscription;
let lanes_subscription;
let harbors_subscription;
let shipments_subscription;

Template.main.onCreated(function () {
  users_subscription = Meteor.subscribe('Users');
  lanes_subscription = Meteor.subscribe('Lanes');
  //TODO: Make these subscriptions specific to the totals needed, do it server-side
  // Maybe this: https://stackoverflow.com/questions/27948046/meteor-publish-just-the-count-for-a-collection
  // Or this: https://atmospherejs.com/tmeasday/publish-counts
  // Or just count server-side and publish a collection of counts

  //harbors_subscription = Meteor.subscribe('Harbors');
  //shipments_subscription = Meteor.subscribe('Shipments');
});

Template.main.helpers({
  is_loaded () {
    if (
      ! Meteor.loggingIn() &&
      users_subscription.ready() &&
      lanes_subscription.ready()
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

