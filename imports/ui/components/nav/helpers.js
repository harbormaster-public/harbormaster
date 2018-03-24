import { Template } from 'meteor/templating';

Template.nav.helpers({
  active (nav) {
    let name = FlowRouter.getRouteName('name');

    if (nav == name) return 'active';

    return '';
  }
})
