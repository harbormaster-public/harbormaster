import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes/lanes.js';

Template.lanes.helpers({
  lanes: function () {
    return Lanes.find();
  }
});
