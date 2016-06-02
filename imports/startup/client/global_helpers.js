import { Template } from 'meteor/templating';

Template.registerHelper('manifest_index', (index) => {
  index++;
  if (index == 1) {
    return '1st';
  } else if (index == 2) {
    return '2nd';
  } else if (index == 3) {
    return '3rd';
  } else {
    return index + 'th';
  }
})
