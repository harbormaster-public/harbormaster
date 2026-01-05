/**
 * Create on-disk aliases so Istanbul HTML reports can resolve Meteor sourcemap
 * sources like:
 *   meteor:/💻app/imports/...
 *
 * Without this, the HTML report can end up embedding "Unable to lookup source"
 * errors because these paths don't exist on disk.
 */

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = process.cwd();

const testBuildServerDir = path.join(
  projectRoot,
  '.meteor-test-app',
  '.meteor',
  'local',
  'build',
  'programs',
  'server',
);

// This is where the HTML reporter ends up looking (relative to server/app).
// It tries to open:
//   <server>/app/meteor:/💻app/imports/...
const aliasRoot = path.join(testBuildServerDir, 'app', 'meteor:', '💻app');

const ensureDir = function (p) {
  fs.mkdirSync(p, { recursive: true });
};

const ensureSymlink = function (linkPath, targetPath) {
  try {
    const st = fs.lstatSync(linkPath);
    if (st.isSymbolicLink() || st.isFile() || st.isDirectory()) {
      fs.rmSync(linkPath, { recursive: true, force: true });
    }
  }
  catch (e) {
    // ENOENT is expected on first run (link doesn't exist yet).
    if (e && e.code !== 'ENOENT') {
      console.warn(e, 'Unable to inspect existing alias path:', linkPath);
    }
  }
  fs.symlinkSync(targetPath, linkPath, 'dir');
};

const main = function () {
  if (!fs.existsSync(testBuildServerDir)) {
    console.error(
      `Missing test build dir: ${testBuildServerDir}\n` +
      'Run `meteor test ... --test-app-path .meteor-test-app` first.',
    );
    process.exit(1);
  }

  ensureDir(aliasRoot);

  // Map meteor:/💻app/imports -> <repo>/imports (and a couple common siblings).
  ensureSymlink(
    path.join(aliasRoot, 'imports'),
    path.join(projectRoot, 'imports'),
  );
  ensureSymlink(
    path.join(aliasRoot, 'client'),
    path.join(projectRoot, 'client'),
  );
  ensureSymlink(
    path.join(aliasRoot, 'server'),
    path.join(projectRoot, 'server'),
  );
};

main();


