import '../imports/startup/server';
import '../imports/startup/config/login';
import '../imports/startup/config/constants';
import '../imports/api/lanes/server';
import '../imports/api/users/server';
import '../imports/api/harbors/server';
import '../imports/api/shipments/server';

import { Meteor } from 'meteor/meteor';
import { Captains } from '../imports/api/captains';
import { Harbormasters } from '../imports/api/harbormasters';
import { Lanes } from '../imports/api/lanes';
import { Shipments } from '../imports/api/shipments';
import { Users } from '../imports/api/users';
import { Harbors } from '../imports/api/harbors';

console.log('Modules loaded.');
Meteor.startup(() => {
  console.log('Server started.');
});
