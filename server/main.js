import '../imports/startup/server';
import '../imports/startup/config/login';
import '../imports/startup/config/constants';
import '../imports/api/lanes/server';
import '../imports/api/users/server';
import '../imports/api/harbors/server';
import '../imports/api/shipments/server';

import { Meteor } from 'meteor/meteor';
import '../imports/api/captains';
import '../imports/api/harbormasters';
import '../imports/api/lanes';
import '../imports/api/shipments';
import '../imports/api/users';
import '../imports/api/harbors';

console.log('Modules loaded.');
Meteor.startup(() => {
  console.log('Server started.');
});
