import { Template } from 'meteor/templating';

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

Template.registerHelper('manifest_index', manifest_index);


