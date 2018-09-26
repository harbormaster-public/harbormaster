import { Template } from 'meteor/templating';

Template.harbors.events({
  'submit form' (e) {
    e.preventDefault();
    debugger;
  },
});
