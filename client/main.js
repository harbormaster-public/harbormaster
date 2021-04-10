import { Meteor } from 'meteor/meteor';

import '../imports/startup/config/namespace';
import '../imports/startup/config/constants';
import '../imports/startup/config/login';
import '../imports/startup/client/global_helpers';
import '../imports/startup/client/spinner';
import '../imports/startup/client/routes';

import './main.html';

import { Captains } from '../imports/api/captains';
import { Harbormasters } from '../imports/api/harbormasters';
import { Lanes } from '../imports/api/lanes';
import { Shipments } from '../imports/api/shipments';
import { Users } from '../imports/api/users';

