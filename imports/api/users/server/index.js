import { Users } from '..';
import methods from './methods';

/* istanbul ignore next */
Meteor.publish('Users', function () {
  return Users.find();
});

Meteor.methods(methods);
