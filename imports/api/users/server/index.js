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
      let password = uuid.v4();
      Accounts.createUser({ email, password });
      Users.insert({ _id: email });
      user_account = Accounts.findUserByEmail(email);
    }

    if (
      user_account &&
      !H.isE2E
    ) Accounts.sendResetPasswordEmail(user_account._id);

    return user_account || user_record || false;
  },

  'Users#expire_user' (email) {
    let expired_password = uuid.v4();
    let user = Accounts.findUserByEmail(email);
    Users.update(email, {$set: { expired: true }});

    Accounts.setPassword(user._id, expired_password);

    return email;
  },

  'Users#update' (email, user) {
    Users.update(email, user);
    return true;
  },

  'Users#reset_password' (email) {
    if (H.isE2E) return;
    
    Accounts.sendResetPasswordEmail(
      Accounts.findUserByEmail(email)._id
    );

    return email;
  },
});
