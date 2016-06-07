import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes/lanes.js';

Template.lanes.events({
  'click #new-lane': function (event) {
    Session.set('lane', null);
  }
});
