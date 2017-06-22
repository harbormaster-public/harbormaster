import { Accounts } from 'meteor/accounts-base';
import { Users } from '..';
import uuid from 'uuid';

Meteor.publish('Users', function () {
  return Users.find();
});

Meteor.methods({
  'Users#invite_user' (email) {
    let existing_user = Accounts.findUserByEmail(email);

    if (! email) return false;

    if (! existing_user) {
      let tmp_password = uuid.v4();
      Accounts.createUser({ email, tmp_password });
      Users.insert({ _id: email });
      existing_user = Accounts.findUserByEmail(email);
    }

    Accounts.sendResetPasswordEmail(existing_user._id);

    return existing_user;
  },

  'Users#expire_user' (email) {
    let expired_password = uuid.v4();
    let user = Accounts.findUserByEmail(email);

    Accounts.setPassword(user._id, expired_password);

    return email;
  }
});
