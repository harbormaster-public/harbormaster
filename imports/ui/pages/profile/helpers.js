import { Template } from 'meteor/templating';
import { Users } from '../../../api/users';
import { Lanes } from '../../../api/lanes';

Template.profile.helpers({

  user_email () {
    var user_id = FlowRouter.getParam('user_id') ||
      Meteor.user().emails[0].address
    ;
    var user = Users.findOne(user_id);

    return user ? user._id : '';
  },

  is_harbormaster () {
    var user_id = FlowRouter.getParam('user_id') ||
      Meteor.user().emails[0].address
    ;
    var user = Users.findOne(user_id);

    return user ? user.harbormaster : '';
  },

  not_harbormaster () {
    var current_user = Meteor.user().emails[0].address;
    var user_id = FlowRouter.getParam('user_id') || current_user;
    var user = Users.findOne(user_id);
    var current_harbormaster = Users.findOne(current_user) ?
      Users.findOne(current_user).harbormaster :
      false
    ;

    if (current_harbormaster) { return false; }

    return user ? ! user.harbormaster : true;
  },

  is_captain () {
    var user_id = FlowRouter.getParam('user_id') ||
      Meteor.user().emails[0].address
    ;
    var user = Users.findOne(user_id);
    var pliable_lanes = user ?
      Lanes.find({ captains: { $in: [user._id] } }).fetch() :
      []
    ;

    return pliable_lanes.length ? true : false;
  },

  lanes () {
    var lanes = Lanes.find().fetch();

    return lanes;
  },

  can_ply () {
    var user_id = FlowRouter.getParam('user_id') ||
      Meteor.user().emails[0].address
    ;
    var user = Users.findOne(user_id);

    if (user && user.harbormaster) { return true; }
    if (this.captains) {
      let can_ply = _.contains(this.captains, user_id);

      return can_ply;
    }

    return false;
  },

  can_change_plying () {
    var user_id = FlowRouter.getParam('user_id');
    var current_user = Meteor.user().emails[0].address;
    var user = Users.findOne(user_id);
    var current_harbormaster = Users.findOne(current_user) ?
      Users.findOne(current_user).harbormaster :
      false
    ;

    if (user_id == current_user || user && user.harbormaster) { return true; }

    if (current_harbormaster) { return false; }

    if (! user || ! user.harbormaster) { return true; }
  },

  can_change_webhook () {
    var current_user = Meteor.user().emails[0].address;
    var current_harbormaster = Users.findOne(current_user) ?
      Users.findOne(current_user).harbormaster :
      false
    ;

    return ! current_harbormaster;
  },

  webhook_allowed () {
    var user_id = FlowRouter.getParam('user_id') ||
      Meteor.user().emails[0].address
    ;

    if (! this.tokens) { return false; }

    return _.find(this.tokens, function (tokens) {
      return tokens == user_id;
    });
  },

  webhook_token () {
    var user_id = FlowRouter.getParam('user_id') ||
      Meteor.user().emails[0].address
    ;

    if (! this.tokens) { return ''; }

    return _.invert(this.tokens)[user_id];
  }
});
