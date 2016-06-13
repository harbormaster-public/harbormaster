import { Template } from 'meteor/templating';

Template.nav.events({
  'click .logout' () {
    Accounts.logout();
  }
});
