import { Users } from '..';
import methods from './methods';

Meteor.publish('Users', function () {
  return Users.find();
});

Meteor.methods(methods);
