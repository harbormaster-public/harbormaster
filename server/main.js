import fs from 'fs';
import path from 'path';
import expandTilde from 'expand-tilde';

let harbormaster_data_dir = expandTilde('~/.harbormaster');
let startup_dir = harbormaster_data_dir + '/startup';

if (fs.existsSync(startup_dir)) {
  console.log('Loading userland startup files...');
  fs.readdirSync(startup_dir).forEach(function (file) {
    let file_path = path.join(startup_dir, file);
    let stats = fs.statSync(file_path);

    if (
      stats.isDirectory() ||
      ! stats.isFile() ||
      ! file.match(/\.js$/)
    ) return;

    try {
      let string = fs.readFileSync(file_path).toString();
      eval(string);
      console.log('Startup file loaded:', file);
    } catch (err) {
      console.error('Warning!  Unable to load userland startup file:', file);
      console.error(err);
    }
  });
}

import { Meteor } from 'meteor/meteor';

import '../imports/startup/config/namespace';
import '../imports/startup/config/login';
import '../imports/startup/server/accounts';
import '../imports/startup/server/routes';
import '../imports/startup/server/harbors';

import { Captains } from '../imports/api/captains';
import { Harbormasters } from '../imports/api/harbormasters';
import { Lanes } from '../imports/api/lanes';
import { Shipments } from '../imports/api/shipments';
import { Users } from '../imports/api/users';
import { Harbors } from '../imports/api/harbors';
import '../imports/api/lanes/server';
import '../imports/api/users/server';
import '../imports/api/harbors/server';
import '../imports/api/shipments/server';

console.log('Modules loaded.');
Meteor.startup(() => {
  console.log('Server started.');
});
