import { Users } from '..';
import methods from './methods';

/* istanbul ignore next */
Meteor.publish('Users', function (view, _id) {
  let users;

  if (_id) users = Users.find({ _id });
  else users = Users.find();

  return users;
});

Meteor.methods(methods);
