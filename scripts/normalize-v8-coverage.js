/**
 * Normalize V8 coverage JSON files written by Node (NODE_V8_COVERAGE) so that
 * tools like `c8` can read Meteor bundle scripts.
 *
 * Meteor records many scripts with `meteor://💻app/...` URLs. We rewrite those
 * URLs to real files inside the persisted `--test-app-path` build output.
 *
 * This script is intentionally small and dependency-free.
 */

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = process.cwd();

const v8Dir = path.join(projectRoot, '.coverage', 'v8');
const testBuildServerDir = path.join(
  projectRoot,
  '.meteor-test-app',
  '.meteor',
  'local',
  'build',
  'programs',
  'server',
);

const appDir = path.join(testBuildServerDir, 'app');
const packagesDir = path.join(testBuildServerDir, 'packages');

const APP_PREFIX = 'meteor://💻app/app/';
const PACKAGES_PREFIX = 'meteor://💻app/packages/';

const rewriteUrl = function (url) {
  if (typeof url !== 'string') return url;
  if (url.startsWith(APP_PREFIX)) {
    return path.join(appDir, url.slice(APP_PREFIX.length));
  }
  if (url.startsWith(PACKAGES_PREFIX)) {
    return path.join(packagesDir, url.slice(PACKAGES_PREFIX.length));
  }
  return url;
};

const main = function () {
  if (!fs.existsSync(v8Dir)) {
    console.error(`V8 coverage dir missing: ${v8Dir}`);
    process.exit(1);
  }
  if (!fs.existsSync(testBuildServerDir)) {
    console.error(
      `Test build dir missing: ${testBuildServerDir}\n` +
      'Did you run `meteor test ... --test-app-path .meteor-test-app` first?',
    );
    process.exit(1);
  }

  const jsonFiles = fs
    .readdirSync(v8Dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(v8Dir, f));

  for (const file of jsonFiles) {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);

    if (Array.isArray(data.result)) {
      for (const entry of data.result) {
        entry.url = rewriteUrl(entry.url);
      }
    }

    fs.writeFileSync(file, JSON.stringify(data));
  }
};

main();


