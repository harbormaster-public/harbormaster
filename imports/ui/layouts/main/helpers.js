import { Template } from 'meteor/templating';

Template.main.helpers({
  logged_in: function () {
    return Meteor.user();
  }
});

