import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes/lanes.js';

Template.lanes.events({
  'click #new-lane' (event) {
    Session.set('lane', null);
  },

  'click .delete-lane' (event) {
    Lanes.remove(this._id);
  }
});
