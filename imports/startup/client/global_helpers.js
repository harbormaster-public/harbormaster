import { Template } from 'meteor/templating';
import { Lanes } from '../../api/lanes';

export const manifest_index = (index) => {
  pretty_index = index + 1;
  if (pretty_index == 1) {
    return '1st';
  } else if (pretty_index == 2) {
    return '2nd';
  } else if (pretty_index == 3) {
    return '3rd';
  }

  return pretty_index + 'th';
};

export const current_lane = () => {
  let name = FlowRouter.getParam('name');

  let lane =  Lanes.findOne({ name: name });

  return lane;
}

Template.registerHelper('manifest_index', manifest_index);
Template.registerHelper('current_lane', current_lane);


