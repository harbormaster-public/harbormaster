import { Template } from 'meteor/templating';

Template.add_user.events({
  'submit form' (event, instance) {
    var $email = instance.$('.email-user-invite');
    var $password = instance.$('.password-user-invite');
    var $confirm = instance.$('.confirm-user-invite');

    event.preventDefault();

    if (! $email.val()) {
      return $email.parent().addClass('is-invalid-label');
    }

    if (! $password.val()) {
      return $password.parent().addClass('is-invalid-label');
    }

    if ($password.val() != $confirm.val()) {
      return $confirm.parent().addClass('is-invalid-label');
    }

    Meteor.call(
      'Users:invite_user',
      $email.val(),
      $password.val(),
      $confirm.val(),
      (err, result) => {

      if (err) { throw err; }

      if (this.fresh) {
        Meteor.loginWithPassword($email.val(), $password.val());
      } else {
        FlowRouter.go('/users');
      }

    });
  }

});
