import fs from "fs";
import path from "path";
import expandTilde from "expand-tilde";
import mkdirp from "mkdirp";
import { checkSync } from "diskusage";
import child_process from "child_process";
import Module from 'module';
import is_git_url from 'is-git-url';
import { Lanes } from "../../api/lanes";
import { Users } from "../../api/users";
import { Harbors } from "../../api/harbors";
import { Shipments } from "../../api/shipments";

const harbors_dir = expandTilde("~/.harbormaster/harbors");
const depot_dir = expandTilde("~/.harbormaster/depot");
const harbormaster_dir = expandTilde("~/.harbormaster");
const harbors_upstream_packages = path.join(harbormaster_dir, "package.json");
const harbors_upstream_dir = path.join(harbormaster_dir, "node_modules");
const reload_exit_code = 10;
// Meteor may run server code with cwd inside `.meteor/local/build/...`, but
// tooling like meteor-vite expects paths in `package.json`
// (e.g. server/entry-meteor.js) to be resolvable from the project root.
// Prefer PWD when available.
const ROOT_DIR = process.env.PWD || process.cwd();

export const initHarborsGlobals = () => {
  H.harbors_dir = harbors_dir;
  H.depot_dir = depot_dir;
  H.should_reload = true;
};

initHarborsGlobals();

// Ensure necessary directories exist (wrapped for explicit test coverage)
export const ensure_depot_dir = () => {
  if (!fs.existsSync(depot_dir)) {
    mkdirp.sync(depot_dir);
  }
};

export const ensure_harbors_dir = () => {
  if (!fs.existsSync(harbors_dir)) {
    mkdirp.sync(harbors_dir);
  }
};


// Ensure harbormaster directory and node_modules exist
export const ensure_harbormaster_dir = () => {
  if (!fs.existsSync(harbormaster_dir)) {
    mkdirp.sync(harbormaster_dir);
  }
};

export const ensure_harbors_upstream_dir = () => {
  if (!fs.existsSync(harbors_upstream_dir)) {
    mkdirp.sync(harbors_upstream_dir);
  }
};

// Ensure package.json exists
export const ensure_harbors_upstream_packages = () => {
  if (!fs.existsSync(harbors_upstream_packages)) {
    fs.writeFileSync(harbors_upstream_packages, JSON.stringify({
      name: "harbormaster-upstream",
      version: "1.0.0",
      description: "Upstream dependencies for Harbormaster harbors",
      dependencies: {},
    }, null, 2));
  }
};

ensure_harbormaster_dir();
ensure_depot_dir();
ensure_harbors_dir();
ensure_harbors_upstream_dir();
ensure_harbors_upstream_packages();

// Add ~/.harbormaster/node_modules to Node's module resolution
const originalNodeModulePaths = Module._nodeModulePaths;
Module._nodeModulePaths = function (from) {
  const paths = originalNodeModulePaths.call(this, from);
  /* istanbul ignore else */
  if (fs.existsSync(harbors_upstream_dir)) {
    paths.unshift(harbors_upstream_dir);
  }
  return paths;
};

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
    if (!H.isTest) console.log("*** HARBORS CHANGED, EXITING. ***");
    process.on('exit', function () {
      child_process.spawn(
        process.argv.shift(),
        process.argv,
        {
          cwd: process.cwd(),
          detached: true,
          stdio: "inherit",
        },
      );
    });
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

  // https://nodejs.org/docs/latest/api/fs.html#fs_caveats
  try {
    fs.watch(harbors_dir, { recursive: true }, H.reload);
    if (!H.isTest) console.log(`Watching ${harbors_dir} recursively...`);
  }
  catch (err) {
    fs.watch(harbors_dir, { recursive: false }, H.reload);
    // Log message first so test stubs (which capture only the first arg)
    // still receive the human-readable string.
    if (!H.isTest) console.log(
      `Watching ${harbors_dir} *non*-recursively...`,
      err,
    );
  }
};
/* istanbul ignore next */
if (!H.isTest) setup_harbor_dirs();

export const scan_depot = async (new_harbor) => {
  /* istanbul ignore next */
  if (new_harbor && !H.isTest) console.log(`Adding new harbor: ${new_harbor}`);
  /* istanbul ignore next */
  else if (!H.isTest) console.log(
    `Enumerating Harbors found in depot: ${depot_dir}`,
  );

  let harbor_list = new_harbor ? [new_harbor] : fs.readdirSync(depot_dir);
  for (const file of harbor_list) {
    let depot_path = path.join(depot_dir, file);
    let stats = fs.statSync(depot_path);
    let harbor_name = file;
    let harbor = (await Harbors.findOneAsync(harbor_name)) || {};
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
    await Harbors.upsertAsync({ _id: harbor_name }, harbor);
  }
};
H.scan_depot = scan_depot;
/* istanbul ignore next */
if (!H.isTest) H.scan_depot();

export const isModuleNotFoundError = (e) => {
  return !!(e.code === 'MODULE_NOT_FOUND' ||
    (e.message && e.message.includes('Cannot find module')));
};

// npm package name validation (intentionally conservative).
// Used to prevent `npm i` from crashing on invalid dependency keys in
// `~/.harbormaster/package.json`.
// https://docs.npmjs.com/cli/v10/configuring-npm/package-json#name
export const isValidPackageName = (pkg) => {
  if (typeof pkg !== 'string' || !pkg.length) return false;
  const namePattern = /^[a-z0-9][a-z0-9._-]*$/;
  // Scoped packages: @scope/name
  if (pkg.startsWith('@')) {
    const parts = pkg.split('/');
    if (parts.length !== 2) return false;
    const scope = parts[0].slice(1);
    const name = parts[1];
    if (!scope || !name) return false;
    if (scope.startsWith('_') || name.startsWith('_')) return false;
    return namePattern.test(scope) && namePattern.test(name);
  }
  // Unscoped
  if (pkg.startsWith('_') || pkg.startsWith('.')) return false;
  return namePattern.test(pkg);
};

const normalizeAndCleanUpstreamPackageJson = (packageJson) => {
  packageJson.dependencies = packageJson.dependencies || {};
  let cleaned = false;
  for (const dep of Object.keys(packageJson.dependencies)) {
    if (!isValidPackageName(dep) || dep === 'test') {
      delete packageJson.dependencies[dep];
      cleaned = true;
    }
  }
  return cleaned;
};

const tryLoadCachedUpstream = (pkg, requireCache, cached) => {
  try {
    customRequire(pkg, requireCache);
    cached.push(pkg);
    if (!H.isTest) console.log(`Cached upstream found: ${pkg}`);
  }
  catch (e) {
    /* istanbul ignore next */
    // Log message first so test stubs (which capture only the first arg)
    // still receive the human-readable string.
    if (!H.isTest) console.error(
      `Unable to load cache for upstream: ${pkg}`,
      e,
    );
  }
};

const ensureUpstreamDependency = (packageJson, pkg) => {
  if (!packageJson.dependencies[pkg]) {
    packageJson.dependencies[pkg] = '*';
    return true;
  }
  return false;
};

const callHarborNext = (harborName, entrypoint) => {
  if (typeof entrypoint.next !== 'function') return undefined;
  try {
    return entrypoint.next();
  }
  catch (e) {
    /* istanbul ignore next */
    if (!H.isTest && !H.isE2E) {
      console.error(`Harbor next() failed for ${harborName}:`, e);
    }
    return undefined;
  }
};

const callHarborConstraints = (harborName, entrypoint) => {
  if (typeof entrypoint.constraints !== 'function') return {};
  try {
    return entrypoint.constraints();
  }
  catch (e) {
    /* istanbul ignore next */
    if (!H.isTest && !H.isE2E) {
      console.error(
        `Harbor constraints() failed for ${harborName}:`,
        e,
      );
    }
    return {};
  }
};

const callHarborRenderInput = async (harborName, entrypoint) => {
  if (typeof entrypoint.render_input !== 'function') {
    return "<p><em>No render_input() provided.</em></p>";
  }
  try {
    return await entrypoint.render_input();
  }
  catch (e) {
    /* istanbul ignore next */
    if (!H.isTest && !H.isE2E) {
      console.error(
        `Harbor render_input() failed for ${harborName}:`,
        e,
      );
    }
    return (
      `<p><strong>Error rendering input for ${harborName}` +
      `</strong></p>`
    );
  }
};

export const loadNativeModule = (filePath, source) => {
  const mod = new Module(filePath);
  mod.filename = filePath;
  mod.paths = Module._nodeModulePaths(path.dirname(filePath));

  // When the source is already in memory (harbor scripts + tests), compile it
  // as CommonJS without hitting the filesystem.
  if (typeof source === 'string') {
    mod._compile(source, filePath);
    return mod.exports;
  }

  // Fallback: load from disk (used by `customRequire()` when resolving paths).
  return Module.prototype.require.call(mod, filePath);
};

export const resolveModulePath = (moduleName) => {
  const modulePath = path.resolve(harbors_upstream_dir, moduleName);
  if (!fs.existsSync(modulePath)) return null;

  const packageJsonPath = path.join(modulePath, 'package.json');
  /* istanbul ignore else */
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const mainEntry = pkg.main || 'index.js';
      const mainPath = path.resolve(modulePath, mainEntry);
      const hasExtension = !!path.extname(mainEntry);

      if (fs.existsSync(mainPath)) {
        return mainPath;
      }

      const mainPathWithExt = !hasExtension ? `${mainPath}.js` : null;
      if (mainPathWithExt && fs.existsSync(mainPathWithExt)) {
        return mainPathWithExt;
      }

      /* istanbul ignore next */
      if (!H.isTest) {
        const triedPaths = hasExtension ?
          mainPath :
          `${mainPath} and ${mainPath}.js`;
        console.warn(
          `Package.json main entry point not found for ${moduleName}: ` +
          `tried ${triedPaths}`,
        );
      }
    }
    catch (e) {
      /* istanbul ignore next */
      if (!H.isTest) {
        console.warn(
          `Failed to parse package.json for ${moduleName}: ${e.message}`,
        );
      }
    }
  }

  const indexPath = path.resolve(modulePath, 'index.js');
  return fs.existsSync(indexPath) ? indexPath : null;
};

export const customRequire = (moduleName, cache = {}) => {
  const originalRequire = require;
  try {
    return originalRequire(moduleName);
  }
  catch (e) {
    if (!isModuleNotFoundError(e)) {
      throw e;
    }

    const resolvedPath = cache[moduleName] || resolveModulePath(moduleName);
    if (!resolvedPath) throw e;

    cache[moduleName] = resolvedPath;
    return loadNativeModule(resolvedPath);
  }
};

export const register_harbors = async () => {
  let packages = [];
  let cached = [];
  const requireCache = {};

  // Load cached upstream deps from ~/.harbormaster/package.json (and clean up
  // invalid keys so future installs don't crash).
  try {
    if (fs.existsSync(harbors_upstream_packages)) {
      const packageJson = JSON.parse(
        fs.readFileSync(harbors_upstream_packages, 'utf8'),
      );
      // Clean invalid/stale dependency keys even if we aren't installing
      // anything
      // this run (otherwise a bad entry can persist forever).
      if (normalizeAndCleanUpstreamPackageJson(packageJson)) {
        try {
          fs.writeFileSync(
            harbors_upstream_packages,
            JSON.stringify(packageJson, null, 2),
          );
        }
        catch (e) { throw e; }
      }

      const dependencies = packageJson.dependencies;
      for (const pkg of Object.keys(dependencies)) {
        // `normalizeAndCleanUpstreamPackageJson()` removed invalid keys.
        tryLoadCachedUpstream(pkg, requireCache, cached);
      }
    }
  }
  catch (e) { console.error(e); }

  /* istanbul ignore next */
  if (!H.isTest) console.log(`Registering Harbors from: ${harbors_dir}`);
  try {
    const files = await new Promise((resolve, reject) =>
      fs.readdir(
        harbors_dir,
        (err, list) => (err ? reject(err) : resolve(list)),
      ),
    );

    for (const file of files) {
      const harbor_path = path.join(harbors_dir, file);
      const stats = fs.statSync(harbor_path);

      /* istanbul ignore else */
      if (
        stats.isDirectory() || !stats.isFile() || !file.match(/\.js$/)
      ) continue;

      try {
        const string = await new Promise((resolve, reject) =>
          fs.readFile(
            harbor_path,
            'utf8',
            (err, data) => (err ? reject(err) : resolve(data)),
          ),
        );
        fs.watch(harbor_path, H.reload);

        let harbor_name;
        // NOTE: These harbor scripts are authored as CommonJS and often rely on
        // non-strict semantics (e.g. duplicate params, implicit globals).
        // Evaluating them from a strict-mode module will throw.
        // Load them via Node's CJS module compiler instead.
        const entrypoint = loadNativeModule(harbor_path, String(string));
        const register = entrypoint.register(Lanes, Users, Harbors, Shipments);
        harbor_name =
          typeof register === "object" && register.name
            ? register.name
            : register;

        if (typeof harbor_name !== "string") throw new Error(
          `Unable to register harbor name: ${harbor_name}`,
        );

        /* istanbul ignore next */
        if (!H.isTest) console.log(
          `Registering packages for "${harbor_name}"...`,
        );
        /* istanbul ignore next */
        if (register.pkgs instanceof Array && register.pkgs.length) {
          register.pkgs.forEach((pkg) => {
            if (
              cached.indexOf(pkg) == -1 &&
              packages.indexOf(pkg) == -1
            ) packages.push(pkg);
          });

          if (!H.isTest) console.log(
            `Packages registered: ${register.pkgs.join(' ')}`,
          );
        }

        H.harbors[harbor_name] = entrypoint;
        callHarborNext(harbor_name, entrypoint);
      }
      catch (err) {
        /* istanbul ignore next */
        if (!H.isTest) console.error(
          `Warning!  Unable to register Harbor: ${file}`,
        );
        console.error(err);
      }
    }
  }
  catch (err) {
    console.error(err);
  }

  if (packages.length) {
    const packagesToInstall = packages.filter((pkg) => (
      isValidPackageName(pkg) || is_git_url(pkg) || pkg.indexOf('git+') === 0
    ));
    /* istanbul ignore next */
    if (!H.isTest) console.log(
      `Installing packages: ${packagesToInstall.join(' ')}`,
    );

    // Read current package.json
    let packageJson = { dependencies: {} };
    if (fs.existsSync(harbors_upstream_packages)) {
      try {
        packageJson = JSON.parse(
          fs.readFileSync(harbors_upstream_packages, 'utf8'),
        );
        normalizeAndCleanUpstreamPackageJson(packageJson);
      }
      catch (e) {
        console.error(
          `Error reading ${harbors_upstream_packages}:`, e,
        );
        packageJson = { dependencies: {} };
      }
    }

    // Add new packages to dependencies
    // (without version to let npm resolve latest)
    for (const pkg of packagesToInstall) {
      if (isValidPackageName(pkg)) ensureUpstreamDependency(packageJson, pkg);
    }

    // Write updated package.json
    fs.writeFileSync(
      harbors_upstream_packages,
      JSON.stringify(packageJson, null, 2),
    );

    // Install packages to ~/.harbormaster/node_modules
    if (packagesToInstall.length) {
      const install_cmd = `npm i --save-prod --save-exact ${
        packagesToInstall.join(' ')
      } --no-fund --prefix ${harbormaster_dir}`;

      try {
        const result = child_process.execSync(install_cmd, {
          cwd: harbormaster_dir,
          stdio: ['pipe', 'pipe', 'pipe'],
          encoding: 'utf8',
        });
        /* istanbul ignore next */
        if (!H.isTest && result) {
          console.log(result);
        }
      }
      catch (err) {
        /* istanbul ignore next */
        if (!H.isTest) {
          console.error(`Failed to install packages: ${packages.join(' ')}`);
          console.error(`Command: ${install_cmd}`);
          console.error(`Error: ${err.message}`);
          if (err.stdout) console.error(`stdout: ${err.stdout}`);
          if (err.stderr) console.error(`stderr: ${err.stderr}`);
        }
      }
    }
  }

  for (const registered_harbor in H.harbors) {
    /* istanbul ignore next */
    if (H.harbors.hasOwnProperty(registered_harbor)) {
      const entrypoint = H.harbors[registered_harbor];
      let harbor = await Harbors.findOneAsync(registered_harbor) || {};
      harbor.next = callHarborNext(registered_harbor, entrypoint);
      harbor.constraints = callHarborConstraints(registered_harbor, entrypoint);
      harbor.rendered_input = await callHarborRenderInput(
        registered_harbor,
        entrypoint,
      );
      harbor.registered = true;
      await Harbors.upsertAsync({ _id: registered_harbor }, harbor);
      /* istanbul ignore next */
      if (!H.isTest) console.log(`Harbor registered: ${registered_harbor}`);
    }
  }
  /* istanbul ignore next */
  if (!H.isTest) console.log("All harbors registered.");
  process.chdir(ROOT_DIR);
};
/* istanbul ignore next */
if (!H.isTest) register_harbors();
