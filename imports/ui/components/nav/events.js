import { Template } from 'meteor/templating';

Template.nav.events({
  'click .logout' () {
    AccountsTemplates.logout();
  }
});
