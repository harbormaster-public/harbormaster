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

import puppeteer from 'puppeteer';

console.log('Modules loaded.');
Meteor.startup(() => {
  console.log('Server started.');
  Meteor.settings.public.AMOUNT_SHOWN = process.env.AMOUNT_SHOWN ?
    process.env.AMOUNT_SHOWN :
    H.AMOUNT_SHOWN
  ;
  console.log(`Number of shipments to show at a time: ${
    Meteor.settings.public.AMOUNT_SHOWN
  }`);

  console.log(`Puppeteer loaded: ${puppeteer._preferredRevision}`);
});
