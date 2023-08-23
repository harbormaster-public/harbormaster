import fs from 'fs';
import path from 'path';
import expandTilde from 'expand-tilde';

let harbormaster_data_dir = expandTilde('~/.harbormaster');
let startup_dir = harbormaster_data_dir + '/startup';

export const load_userland = function (file) {
  let file_path = path.join(startup_dir, file);
  let stats = fs.statSync(file_path);

  /* istanbul ignore else */
  if (
    stats.isDirectory() ||
    !stats.isFile() ||
    !file.match(/\.js$/)
  ) return;

  try {
    let string = fs.readFileSync(file_path).toString();
    eval(string);
    /* istanbul ignore next */
    if (!H.isTest) console.log('Startup file loaded:', file);
  }
  catch (err) {
    console.error('Warning!  Unable to load userland startup file:', file);
    console.error(err);
  }
};

/* istanbul ignore next */
if (fs.existsSync(startup_dir)) {
  if (!H.isTest) console.log('Loading userland startup files...');
  fs.readdirSync(startup_dir).forEach(load_userland);
}

