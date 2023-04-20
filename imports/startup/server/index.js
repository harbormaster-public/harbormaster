import '../config/namespace';
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
    harbormaster_data_dir
  );
  fs.mkdirSync(harbormaster_data_dir);
  console.log('Data directory created.');
}

