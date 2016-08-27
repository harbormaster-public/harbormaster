import { Accounts } from 'meteor/accounts-base';
import { Users } from '../users';

Meteor.methods({
  'Users#invite_user' (email, password, confirm) {
    var existing_user = Users.findOne(email);
    var user_id;

    if (existing_user) { return false; }

    if (! email || ! password || password != confirm) { return false; }

    user_id = Accounts.createUser({ email: email, password: password });
    Users.insert({ _id: email });

    return user_id;
  }
});
