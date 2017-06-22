import { Template } from 'meteor/templating';

Template.add_user.events({
  'submit form' (event, instance) {
    event.preventDefault();

    let $email = instance.$('.email-user-invite');

    if (! $email.val()) return $email.parent().addClass('is-invalid-label');

    Meteor.call('Users#invite_user', $email.val(), (err, result) => {

      if (err) { throw err; }

      if (this.fresh) FlowRouter.go('/')
      else FlowRouter.go('/users');

    });
  }

});
