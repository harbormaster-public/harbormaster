import { Template } from 'meteor/templating';
import { Lanes } from '../../../../api/lanes/lanes.js';
import { Session } from 'meteor/session';

Template.ship_lane.helpers({
  lane () {
    var name = FlowRouter.getParam('name');
    var lane = Lanes.findOne({ name: name });

    return lane ? lane : false;
  }

});
