import { Template } from 'meteor/templating';
import { Users } from '../../../api/users/users.js';

Template.users.helpers({
  users: function () {
    console.log(Users.find().fetch());
    return Users.find().fetch();
  }
});
