import fs from 'fs';
import path from 'path';
import expandTilde from 'expand-tilde';
import mkdirp from 'mkdirp';
import { execSync } from 'child_process';
import { Lanes } from '../../api/lanes';
import { Users } from '../../api/users';
import { Harbors } from '../../api/harbors';
import { Shipments } from '../../api/shipments';

const harbors_dir = expandTilde('~/.harbormaster/harbors');
const reload_exit_code = 10;

if (! fs.existsSync(harbors_dir)) {
  console.log(`No harbors directory found at: ${harbors_dir}`);
  mkdirp.sync(harbors_dir);
  console.log('Harbors directory created.');
}

let reload = () => {
  console.log('Harbors changed, exiting.');
  process.exit(reload_exit_code);
};

fs.watch(harbors_dir, { recursive: true }, reload);

console.log(`Registering Harbors from: ${harbors_dir}`);
fs.readdirSync(harbors_dir).forEach(function (file) {
  let harbor_path = path.join(harbors_dir, file);
  let stats = fs.statSync(harbor_path);

  if (stats.isDirectory() || ! stats.isFile() || ! file.match(/\.js$/)) return;

  try {
    let string = fs.readFileSync(harbor_path).toString();
    fs.watch(harbor_path, reload);

    let entrypoint = eval(string);
    let harbor_name;
    let packages = [];
    let register = entrypoint.register(Lanes, Users, Harbors, Shipments);
    harbor_name = typeof register === 'object' && register.name ?
      register.name :
      register
    ;

    if (typeof harbor_name !== 'string') throw new Error(
      `Unable to register harbor name: ${harbor_name}`
    );

    if (register.pkgs instanceof Array) {
      register.pkgs.forEach((pkg) => {
        try {
          require.resolve(pkg);
        }
        catch (e) {
          packages.push(pkg);
        }
      });
    }

    if (packages.length) {
      packages = packages.join(' ');
      console.log(`Installing packages: ${packages}`);
      execSync(`npm i -S ${packages}`);
    }

    let harbor = Harbors.findOne(harbor_name);

    H.harbors[harbor_name] = entrypoint;

    Harbors.update({ _id: harbor._id }, harbor);

    entrypoint.next && entrypoint.next();
    harbor.rendered_input = entrypoint.render_input();
    console.log(`Harbor registered: ${file}`);
  }
  catch (err) {
    console.error(`Warning!  Unable to register Harbor: ${file}`);
    console.error(err);
  }

});
console.log('All harbors registered.');
