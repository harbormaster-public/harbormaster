import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes';

Template.users.events({
  'click .expire-user': function (event) {
    event.preventDefault();

    let confirm_message = `Expire user?\n${this._id}`;

    if (window.confirm(confirm_message)) {
      Meteor.call('Users#expire_user', this._id, (err, res) => {
        if (err) throw err;

        console.log('User expired:', res);
        alert('User expired:', res);
      });
    }
  }
});

