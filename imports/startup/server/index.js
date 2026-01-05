import '../config/namespace';
import '../config/namespace.server';
import '../config/e2e';
import './userland';
import './harbors';
import './accounts';
import './routes';
import expandTilde from 'expand-tilde';
import fs from 'fs';

let harbormaster_data_dir = expandTilde('~/.harbormaster');
if (! fs.existsSync(harbormaster_data_dir)) {
  console.log(
    'No data directory found at:\n',
    harbormaster_data_dir,
  );
  fs.mkdirSync(harbormaster_data_dir);
  console.log('Data directory created.');
}

// Cypress E2E helper: expose the actual Mongo URL Meteor is using
// (embedded dev mongo)
// so Cypress node-side tasks can connect to the same database.
if (process?.env?.E2E === '1') {
  try {
    if (process.env.MONGO_URL) {
      fs.writeFileSync(
        `${process.cwd()}/.e2e-mongo-url`,
        process.env.MONGO_URL,
        { encoding: 'utf8' },
      );
    }
  }
  catch (e) {
    throw e;
  }
}

