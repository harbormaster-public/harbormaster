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

