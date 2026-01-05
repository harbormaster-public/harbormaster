/**
 * These modules are automatically imported by jorgenvatle:vite.
 * You can commit these to your project or move them elsewhere if you'd like,
 * but they must be imported somewhere in your Meteor mainModule.
 *
 * More info:
 * https://github.com/JorgenVatle/meteor-vite#lazy-loaded-meteor-packages
 **/
import "../_vite-bundle/server/_entry.mjs";
/** End of vite auto-imports **/
// Server entrypoint for Meteor.

import '../imports/startup/server/index';

// Ensure server-side methods/publications are registered.
import '../imports/api/users/server/index';
import '../imports/api/harbors/server/index';
import '../imports/api/lanes/server/index';
import '../imports/api/shipments/server/index';


