import { Accounts } from 'meteor/accounts-base';
import { Users } from '..';
import uuid from 'uuid';

Meteor.publish('Users', function () {
  return Users.find();
});

Meteor.methods({
  'Users#invite_user' (email) {
    if (! email) return false;

    let user_account = Accounts.findUserByEmail(email);
    let user_record = Users.findOne(email);

    if (! user_account && ! user_record) {
      let tmp_password = uuid.v4();
      Accounts.createUser({ email, tmp_password });
      Users.insert({ _id: email });
      user_account = Accounts.findUserByEmail(email);
    }

    if (user_account) Accounts.sendResetPasswordEmail(user_account._id);

    return user_account || user_record || false;
  },

  'Users#expire_user' (email) {
    let expired_password = uuid.v4();
    let user = Accounts.findUserByEmail(email);

    Accounts.setPassword(user._id, expired_password);

    return email;
  }
});
