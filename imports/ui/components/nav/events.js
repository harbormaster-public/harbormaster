import { Template } from 'meteor/templating';

Template.nav.events({
  'click .logout' () {
    Accounts.logout((err) => {
      if (err) throw err;
    });
  },

  'click .nav-item' (e) {
    e.preventDefault();
    let $link = $(e.target);
    let path = $link.attr('href');
    Session.set('loading', true);
    FlowRouter.go(path);
    Session.set('loading', false);
  },
});
