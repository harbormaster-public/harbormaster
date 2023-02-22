import fs from 'fs';
import path from 'path';
import expandTilde from 'expand-tilde';
import mkdirp from 'mkdirp';
import { checkSync } from 'diskusage';
import getFolderSize from 'get-folder-size';
import { execSync } from 'child_process';
import { Lanes } from '../../api/lanes';
import { Users } from '../../api/users';
import { Harbors } from '../../api/harbors';
import { Shipments } from '../../api/shipments';

const harbors_dir = expandTilde('~/.harbormaster/harbors');
const depot_dir = expandTilde('~/.harbormaster/depot');
const reload_exit_code = 10;

H.harbors_dir = harbors_dir;
H.depot_dir = depot_dir;
H.should_reload = true;

// TODO: https://coderrocketfuel.com/article/get-the-total-size-of-all-files-in-a-directory-using-node-js
console.log(checkSync(H.depot_dir).available)
console.log(await getFolderSize(H.depot_dir));

H.reload = () => {
  if (H.should_reload) {
    console.log('Harbors changed, exiting.');
    process.exit(reload_exit_code);
  }
};

if (! fs.existsSync(harbors_dir)) {
  console.log(`No harbors directory found at: ${harbors_dir}`);
  mkdirp.sync(harbors_dir);
  console.log('Harbors directory created.');
}

if (! fs.existsSync(depot_dir)) {
  console.log(`No depot directory found at ${depot_dir}`);
  mkdirp.sync(depot_dir);
  console.log('Depot directory created.');
}


// https://nodejs.org/docs/latest/api/fs.html#fs_caveats
try {
  fs.watch(harbors_dir, { recursive: true }, H.reload);
  console.log(`Watching ${harbors_dir} recursively...`);
} catch (err) {
  // console.warn(err);
  fs.watch(harbors_dir, { recursive: false }, H.reload);
  console.log(`Watching ${harbors_dir} *non*-recursively...`);
}

console.log(`Enumerating Harbors found in depot: ${depot_dir}`);
fs.readdirSync(depot_dir).forEach(file => {
  let depot_path = path.join(depot_dir, file);
  let stats = fs.statSync(depot_path);
  let harbor_name = file;
  let harbor = Harbors.findOne(harbor_name) || {};
  let version = false;
  let url = false;
  harbor.in_depot = true;

  console.log(`Harbor "${harbor_name}" found in depot.`);
  if (stats.isDirectory()) {
    try {
      const version_check_cmd = `git rev-parse --short HEAD`;
      const origin_check_cmd = `git config --get remote.origin.url`;
      const options = {
        cwd: depot_path,
        stdio: ['pipe', 'pipe', 'ignore'], //in, out, err
      };
      version = execSync(version_check_cmd, options).toString().replace('\n', '');
      url = execSync(origin_check_cmd, options).toString().replace('\n', '');
      console.log(`Version ${version} found from ${url}`);
    } catch (err) {
      const warning = `Unable to determine origin for "${harbor_name}"
        Found at:  ${depot_path}
        Error msg: ${err}
      `;
      console.log(warning);
    }
  }
  harbor.depot_version = version;
  harbor.depot_url = url;
  Harbors.upsert({ _id: harbor_name }, harbor);
});

console.log(`Registering Harbors from: ${harbors_dir}`);
fs.readdirSync(harbors_dir).forEach(function (file) {
  let harbor_path = path.join(harbors_dir, file);
  let stats = fs.statSync(harbor_path);

  if (stats.isDirectory() || ! stats.isFile() || ! file.match(/\.js$/)) return;

  try {
    let string = fs.readFileSync(harbor_path).toString();
    fs.watch(harbor_path, H.reload);
    
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

    console.log(`Registering packages for "${harbor_name}"...`);
    if (register.pkgs instanceof Array) {
      register.pkgs.forEach((pkg) => {
        try {
          console.log(`Checking for: ${pkg}...`);
          require(pkg);
          console.log(`Found: ${pkg}`);
        }
        catch (e) {
          console.log(`Missing: ${pkg}`);
          packages.push(pkg);
        }
      });
    }

    if (packages.length) {
      packages = packages.join(' ');
      console.log(`Installing packages: ${packages}`);
      execSync(`npm i ${packages}`);
    }

    let harbor = Harbors.findOne(harbor_name) || {};
    H.harbors[harbor_name] = entrypoint;
    if (entrypoint.next) entrypoint.next();
    harbor.rendered_input = entrypoint.render_input();
    harbor.constraints = entrypoint.constraints && entrypoint.constraints();
    harbor.registered = true;
    Harbors.upsert({ _id: harbor_name }, harbor);
    console.log(`Harbor registered: ${file}`);
  }
  catch (err) {
    console.error(`Warning!  Unable to register Harbor: ${file}`);
    console.error(err);
  }

});
console.log('All harbors registered.');
