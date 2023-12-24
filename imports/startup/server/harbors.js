import fs from "fs";
import path from "path";
import expandTilde from "expand-tilde";
import mkdirp from "mkdirp";
import is_github_url from 'parse-github-url';
import { checkSync } from "diskusage";
import child_process from "child_process";
import { Lanes } from "../../api/lanes";
import { Users } from "../../api/users";
import { Harbors } from "../../api/harbors";
import { Shipments } from "../../api/shipments";

const harbors_dir = expandTilde("~/.harbormaster/harbors");
const depot_dir = expandTilde("~/.harbormaster/depot");
const upstream_dir = expandTilde("~/.harbormaster/upstream");
const reload_exit_code = 10;
const ROOT_DIR = process.cwd();

H.harbors_dir = harbors_dir;
H.depot_dir = depot_dir;
H.should_reload = true;

// eslint-disable-next-line max-len
// https://coderrocketfuel.com/article/get-the-total-size-of-all-files-in-a-directory-using-node-js
export const convert_bytes = (b) => {
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  if (b == 0) return "n/a";

  const i = parseInt(Math.floor(Math.log(b) / Math.log(1024)), 10);
  if (i == 0) return `${b} ${sizes[i]}`;

  return `${(b / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

H.check_avail_space = () => {
  let b = checkSync(H.depot_dir).available;
  return convert_bytes(b);
};

export const update_avail_space = () => {
  H.space_avail = H.check_avail_space();
  /* istanbul ignore next */
  if (!H.isTest) console.log(`${H.space_avail} available.`);
};
H.update_avail_space = update_avail_space;
/* istanbul ignore next */
if (!H.isTest) H.update_avail_space();

/* istanbul ignore next */
H.reload = () => {
  if (H.should_reload) {
    if (!H.isTest) console.log("Harbors changed, exiting.");
    process.exit(reload_exit_code);
  }
};

/* istanbul ignore next */
export const setup_harbor_dirs = () => {
  if (!fs.existsSync(harbors_dir)) {
    if (!H.isTest) console.log(`No harbors directory found at: ${harbors_dir}`);
    mkdirp.sync(harbors_dir);
    if (!H.isTest) console.log("Harbors directory created.");
  }

  if (!fs.existsSync(depot_dir)) {
    if (!H.isTest) console.log(`No depot directory found at ${depot_dir}`);
    mkdirp.sync(depot_dir);
    if (!H.isTest) console.log("Depot directory created.");
  }

  if (!fs.existsSync(upstream_dir)) {
    if (!H.isTest) console.log(
      `No upstream directory found at ${upstream_dir}`
    );
    mkdirp.sync(upstream_dir);
    if (!H.isTest) console.log("Upstream directory created.");
  }

  if (!fs.existsSync(`${upstream_dir}/package.json`)) {
    fs.writeFileSync(`${upstream_dir}/package.json`, JSON.stringify({
      private: true,
    }));
  }

  // https://nodejs.org/docs/latest/api/fs.html#fs_caveats
  try {
    fs.watch(harbors_dir, { recursive: true }, H.reload);
    if (!H.isTest) console.log(`Watching ${harbors_dir} recursively...`);
  }
  catch (err) {
    fs.watch(harbors_dir, { recursive: false }, H.reload);
    if (!H.isTest) console.log(`Watching ${harbors_dir} *non*-recursively...`);
  }
};
/* istanbul ignore next */
if (!H.isTest) setup_harbor_dirs();

export const scan_depot = (new_harbor) => {
  /* istanbul ignore next */
  if (new_harbor && !H.isTest) console.log(`Adding new harbor: ${new_harbor}`);
  /* istanbul ignore next */
  else if (!H.isTest) console.log(
    `Enumerating Harbors found in depot: ${depot_dir}`
  );

  let harbor_list = new_harbor ? [new_harbor] : fs.readdirSync(depot_dir);
  harbor_list.forEach((file) => {
    let depot_path = path.join(depot_dir, file);
    let stats = fs.statSync(depot_path);
    let harbor_name = file;
    let harbor = Harbors.findOne(harbor_name) || {};
    let version = false;
    let url = false;
    harbor.in_depot = true;

    /* istanbul ignore next */
    if (!H.isTest) console.log(`Harbor "${harbor_name}" found in depot.`);
    /* istanbul ignore else */
    if (stats.isDirectory()) {
      try {
        const version_check_cmd = `git rev-parse --short HEAD`;
        const origin_check_cmd = `git config --get remote.origin.url`;
        const options = {
          cwd: depot_path,
          stdio: ["pipe", "pipe", "ignore"], //in, out, err
        };
        version = child_process.execSync(version_check_cmd, options)
          .toString()
          .replace("\n", "");
        url = child_process.execSync(origin_check_cmd, options)
          .toString()
          .replace("\n", "");
        /* istanbul ignore next */
        if (!H.isTest) console.log(`Version ${version} found from ${url}`);
      }
      catch (err) {
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
};
H.scan_depot = scan_depot;
/* istanbul ignore next */
if (!H.isTest) H.scan_depot();

export const register_harbors = () => {
  /* istanbul ignore next */
  if (!H.isTest) console.log(`Registering Harbors from: ${harbors_dir}`);
  fs.readdirSync(harbors_dir).forEach(function (file) {
    let harbor_path = path.join(harbors_dir, file);
    let stats = fs.statSync(harbor_path);

    /* istanbul ignore else */
    if (stats.isDirectory() || !stats.isFile() || !file.match(/\.js$/)) return;

    try {
      let string = fs.readFileSync(harbor_path).toString();
      fs.watch(harbor_path, H.reload);

      let harbor_name;
      let harbor;
      let packages = [];
      let entrypoint = eval(string);
      let register = entrypoint.register(Lanes, Users, Harbors, Shipments);
      harbor_name =
        typeof register === "object" && register.name
          ? register.name
          : register;

      if (typeof harbor_name !== "string") throw new Error(
        `Unable to register harbor name: ${harbor_name}`
      );

      /* istanbul ignore next */
      if (!H.isTest) console.log(
        `Registering packages for "${harbor_name}"...`
      );
      /* istanbul ignore else */
      if (register.pkgs instanceof Array) {
        register.pkgs.forEach((pkg) => {
          try {
            process.chdir(upstream_dir);
            /* istanbul ignore if */
            if (!H.isTest) {
              console.log(`Checking for: ${pkg}...`);
              if (is_github_url(pkg).name) {
                console.log(
                  `Repo module, loading as "${is_github_url(pkg).name}"`
                );
                require(pkg.name);
              }
              else require(pkg);
            }
            else require(pkg);
            /* istanbul ignore next */
            if (!H.isTest) console.log(`Found: ${pkg}`);
          }
          catch (e) {
            /* istanbul ignore next */
            if (!H.isTest) console.log(`Missing: ${pkg}`);
            packages.push(pkg);
          }
        });
      }
      if (packages.length) {
        /* istanbul ignore next */
        if (!H.isTest) console.log(
          `Installing packages: ${packages.join(' ')}`
        );
        process.chdir(upstream_dir);
        packages.forEach(pkg => {
          console.log(child_process.execSync(
            `npm i --save -P -E ${pkg} --no-fund --prefix ${upstream_dir}`
          )?.toString());
        });
        register = entrypoint.register(Lanes, Users, Harbors, Shipments);
      }

      harbor = Harbors.findOne(harbor_name) || {};
      H.harbors[harbor_name] = entrypoint;
      process.chdir(upstream_dir);
      if (entrypoint.next) entrypoint.next();
      harbor.rendered_input = entrypoint.render_input();
      harbor.constraints = entrypoint.constraints && entrypoint.constraints();
      harbor.registered = true;
      Harbors.upsert({ _id: harbor_name }, harbor);
      /* istanbul ignore next */
      if (!H.isTest) console.log(`Harbor registered: ${file}`);

    }
    catch (err) {
      /* istanbul ignore next */
      if (!H.isTest) console.error(
        `Warning!  Unable to register Harbor: ${file}`
      );
      console.error(err);
    }
  });
  /* istanbul ignore next */
  if (!H.isTest) console.log("All harbors registered.");
  process.chdir(ROOT_DIR);
};
/* istanbul ignore next */
if (!H.isTest) register_harbors();
