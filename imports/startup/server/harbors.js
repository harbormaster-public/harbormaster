import fs from 'fs';
import path from 'path';
import expandTilde from 'expand-tilde';
import { Lanes } from '../../api/lanes/lanes';
import { Users } from '../../api/users/users';
import { Harbors } from '../../api/harbors';

let harbormaster_data_dir = expandTilde('~/.harbormaster');
let harbors_dir = harbormaster_data_dir + '/harbors';

if (! fs.existsSync(harbormaster_data_dir)) {
  console.log(
    'No data directory found at:\n',
    harbormaster_data_dir
  );
  fs.mkdirSync(harbormaster_data_dir);
  fs.mkdirSync(harbors_dir);
  console.log('Data directory scaffolding created.');
}

console.log('Registering Harbors from:', harbors_dir);
fs.readdirSync(harbors_dir).forEach(function (file) {
  let harbor_path = path.join(harbors_dir, file);
  let stats = fs.statSync(harbor_path);

  if (stats.isDirectory() || ! stats.isFile() || ! file.match(/\.js$/)) return;

  try {
    let harbor_name = file.replace('\.js', '');
    let string = fs.readFileSync(harbor_path).toString();

    $H.harbors[harbor_name] = eval(string);
    $H.harbors[harbor_name].register(Lanes, Users, Harbors);

    let harbor = Harbors.findOne(harbor_name);

    harbor.rendered_input = $H.harbors[harbor_name].render_input();

    Harbors.update({ _id: harbor._id }, harbor);

    console.log('Harbor registered:', file);

  } catch (err) {
    console.error('Warning!  Unable to register Harbor:', file);
    console.error(err);
  }

});
console.log('All harbors registered.');
