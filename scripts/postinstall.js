#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Postinstall patching.
 *
 * patch-package is great, but it can fail if a patch is already applied in an
 * existing node_modules tree (or if the installed package files drift).
 *
 * We want:
 * - Fresh clone + npm install: patches apply and succeed.
 * - Existing node_modules where the patch is already applied: do not fail.
 * - Real patch drift (package changed and patch not applied): fail loudly.
 */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const runPatchPackage = function () {
  const result = child_process.spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['--no', 'patch-package'],
    { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }
  );
  return {
    status: result.status || 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error,
  };
};

const fileContainsAll = function (filePath, needles) {
  try {
    const txt = fs.readFileSync(filePath, 'utf8');
    return needles.every((n) => txt.includes(n));
  }
  catch (e) {
    console.error(e, 'Error reading file:', filePath);
    return false;
  }
};

const isIstanbulReportsPatchAlreadyApplied = function () {
  const annotator = path.join(
    process.cwd(),
    'node_modules',
    'istanbul-reports',
    'lib',
    'html',
    'annotator.js'
  );
  // Behavioral changes made by patches/istanbul-reports+3.2.0.patch
  return fileContainsAll(annotator, [
    'if (!meta || !meta.start || !meta.end) {',
    '// Skip this branch if previous meta is invalid',
  ]);
};

// If our only patch is already applied in the current node_modules tree,
// don't run patch-package at all (avoids noisy output during repeated
// installs).
const istanbulPatchFile = path.join(
  process.cwd(),
  'patches',
  'istanbul-reports+3.2.0.patch'
);
if (
  fs.existsSync(istanbulPatchFile)
  && isIstanbulReportsPatchAlreadyApplied()
) {
  process.exit(0);
}

const result = runPatchPackage();
if (result.error) {
  console.error('[postinstall] Failed to run patch-package:', result.error);
  process.exit(1);
}

if (result.status === 0) {
  const combined = `${result.stdout}${result.stderr}`;
  // Some patch-package versions print an error but still exit 0.
  // Treat this as a hard failure unless we can confirm the patch is applied.
  if (
    combined.includes('**ERROR**')
    && !isIstanbulReportsPatchAlreadyApplied()
  ) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(1);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(0);
}

// patch-package failed. If the only reason is that the patch is already
// applied, treat it as success so developers don't have to delete node_modules.
if (isIstanbulReportsPatchAlreadyApplied()) {
  process.exit(0);
}

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status);


