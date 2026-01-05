/**
 * Post-process an Istanbul coverage JSON file to:
 * - Rewrite Meteor build paths like:
 *     <repo>/.meteor-test-app/.../app/meteor:/💻app/<path>
 *   back to real repo paths:
 *     <repo>/<path>
 * - Drop non-executable ESM import declarations from statement/branch maps so
 *   they don't show up as "uncovered" lines in HTML reports.
 *
 * Usage:
 *   node scripts/postprocess-istanbul-coverage.js <inFile> [outFile]
 */

const fs = require('node:fs');
const path = require('node:path');

// Example: readJson('out.json') -> { '/abs/file.js': {...} }
const readJson = function (p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

// Example: writeJson('out.json', { hello: 'world' }) writes JSON to disk.
const writeJson = function (p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj));
};

// Example: getLines('/tmp/a.js') -> ['const x = 1;', ''] (or null)
const getLines = function (filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  }
  catch (e) {
    console.error(e, 'Error reading file:', filePath);
    return null;
  }
};

// Example: isImportSnippet(['import x from \"y\";'], 1, 1) -> true
const isImportSnippet = function (lines, startLine, endLine) {
  if (!lines) return false;
  const startIdx = Math.max(0, startLine - 1);
  const endIdx = Math.max(0, endLine - 1);
  const slice = lines.slice(startIdx, endIdx + 1).join('\n');
  // Single-line import.
  if (/^\s*import\b/.test(slice)) return true;
  // Multi-line import: v8->istanbul can map statement/branch locations onto
  // interior lines of the import block (e.g. `foo,`), not the `import {` line.
  // If there is an `import` line above us before a blank line, treat as import.
  for (let i = startIdx; i >= 0; i--) {
    const line = lines[i];
    if (i !== startIdx && line.trim() === '') break;
    if (/^\s*import\b/.test(line)) return true;
  }
  return false;
};

// Example: isPunctuationOnlySnippet(['  );'], 1, 1) -> true
const isPunctuationOnlySnippet = function (lines, startLine, endLine) {
  if (!lines) return false;
  const startIdx = Math.max(0, startLine - 1);
  const endIdx = Math.max(0, endLine - 1);
  const slice = lines.slice(startIdx, endIdx + 1).join('\n');
  return /^\s*[\(\)\[\]\{\};,]+?\s*$/.test(slice);
};

// Example: isBlankSnippet(['   '], 1, 1) -> true
const isBlankSnippet = function (lines, startLine, endLine) {
  if (!lines) return false;
  const startIdx = Math.max(0, startLine - 1);
  const endIdx = Math.max(0, endLine - 1);
  const slice = lines.slice(startIdx, endIdx + 1).join('\n');
  return slice.trim() === '';
};

// Example: isCloserOnlySnippet(['});'], 1, 1) -> true
const isCloserOnlySnippet = function (lines, startLine, endLine) {
  if (!lines) return false;
  const startIdx = Math.max(0, startLine - 1);
  const endIdx = Math.max(0, endLine - 1);
  const slice = lines.slice(startIdx, endIdx + 1).join('\n').trim();
  return (
    slice === '};' ||
    slice === '});' ||
    slice === '})' ||
    slice === '})();'
  );
};

// Example: isCommentOnlySnippet(['// hi'], 1, 1) -> true
const isCommentOnlySnippet = function (lines, startLine, endLine) {
  if (!lines) return false;
  const startIdx = Math.max(0, startLine - 1);
  const endIdx = Math.max(0, endLine - 1);
  const slice = lines.slice(startIdx, endIdx + 1).join('\n').trim();
  return slice.startsWith('//') || slice.startsWith('/*');
};

// Example: hasOptionalChainingSnippet(['obj?.x'], 1, 1) -> true
const hasOptionalChainingSnippet = function (lines, startLine, endLine) {
  if (!lines) return false;
  const startIdx = Math.max(0, startLine - 1);
  const endIdx = Math.max(0, endLine - 1);
  const slice = lines.slice(startIdx, endIdx + 1).join('\n');
  return /\?\./.test(slice);
};

// Example: hasIgnoreNextHintSnippet(['/* istanbul ignore next */'], 1, 2)
const hasIgnoreNextHintSnippet = function (lines, startLine, endLine) {
  if (!lines) return false;
  const startIdx = Math.max(0, startLine - 1);
  const endIdx = Math.max(0, endLine - 1);
  const slice = lines.slice(startIdx, endIdx + 1).join('\n');
  return /istanbul ignore next/.test(slice);
};

// Example: looksLikeDeclarationSnippet(['const foo = 1;'], 1, 1) -> true
const looksLikeDeclarationSnippet = function (lines, startLine, endLine) {
  if (!lines) return false;
  const startIdx = Math.max(0, startLine - 1);
  const endIdx = Math.max(0, endLine - 1);
  const slice = lines.slice(startIdx, endIdx + 1).join('\n');
  return /^\s*(export|const|let|var|function|class)\b/.test(slice);
};

// Example: isCatchClauseSnippet(['} catch (e) {'], 1, 1) -> true
const isCatchClauseSnippet = function (lines, startLine, endLine) {
  if (!lines) return false;
  const startIdx = Math.max(0, startLine - 1);
  const endIdx = Math.max(0, endLine - 1);
  const slice = lines.slice(startIdx, endIdx + 1).join('\n').trim();
  return /^(?:\}\s*)?catch\s*\(/.test(slice) && slice.endsWith('{');
};

// Example: isReturnStatementSnippet(['return foo;'], 1, 1) -> true
const isReturnStatementSnippet = function (lines, startLine, endLine) {
  if (!lines) return false;
  const startIdx = Math.max(0, startLine - 1);
  const endIdx = Math.max(0, endLine - 1);
  const slice = lines.slice(startIdx, endIdx + 1).join('\n').trim();
  return slice.startsWith('return ');
};

// Example: isThrowStatementSnippet(['throw err;'], 1, 1) -> true
const isThrowStatementSnippet = function (lines, startLine, endLine) {
  if (!lines) return false;
  const startIdx = Math.max(0, startLine - 1);
  const endIdx = Math.max(0, endLine - 1);
  const slice = lines.slice(startIdx, endIdx + 1).join('\n').trim();
  return slice.startsWith('throw ');
};

const main = function () {
  // Example: node scripts/postprocess-istanbul-coverage.js in.json out.json
  const inFile = process.argv[2];
  const outFile = process.argv[3] || inFile;
  if (!inFile) {
    console.error(
      'Usage: node scripts/postprocess-istanbul-coverage.js <inFile> [outFile]',
    );
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const meteorPrefix = path.join(
    projectRoot,
    '.meteor-test-app',
    '.meteor',
    'local',
    'build',
    'programs',
    'server',
    'app',
    'meteor:',
    '💻app',
  ) + path.sep;

  const cov = readJson(inFile);
  const out = {};

  for (const [fileKey, fc] of Object.entries(cov)) {
    let newKey = fileKey;
    if (fileKey.startsWith(meteorPrefix)) {
      newKey = path.join(projectRoot, fileKey.slice(meteorPrefix.length));
    }

    const lines = getLines(newKey) || getLines(fileKey);

    // Clone the file coverage object shallowly; mutate maps below.
    const next = { ...fc };

    // Drop import declaration "statements" (they are non-executable, but can
    // show up as uncovered due to how v8->istanbul mapping works for ESM).
    if (next.statementMap && next.s) {
      for (const [sid, loc] of Object.entries(next.statementMap)) {
        const startLine = loc?.start?.line;
        const endLine = loc?.end?.line ?? startLine;
        if (!startLine) continue;
        if (
          isImportSnippet(lines, startLine, endLine) ||
          isBlankSnippet(lines, startLine, endLine) ||
          isCloserOnlySnippet(lines, startLine, endLine) ||
          isPunctuationOnlySnippet(lines, startLine, endLine) ||
          isCommentOnlySnippet(lines, startLine, endLine) ||
          isCatchClauseSnippet(lines, startLine, endLine) ||
          // If a nearby `/* istanbul ignore next */` exists, v8->istanbul can
          // still map "statements" onto interior tokens of a complex statement
          // (e.g. chained d3 calls). Drop those artifacts so ignore-next works.
          hasIgnoreNextHintSnippet(
            lines,
            Math.max(1, startLine - 10),
            endLine,
          )
        ) {
          delete next.statementMap[sid];
          delete next.s[sid];
        }
      }
    }

    // Drop branches that map onto import declarations.
    if (next.branchMap && next.b) {
      for (const [bid, bLoc] of Object.entries(next.branchMap)) {
        const startLine = bLoc?.loc?.start?.line;
        const endLine = bLoc?.loc?.end?.line ?? startLine;
        if (!startLine) continue;
        if (isImportSnippet(lines, startLine, endLine)) {
          delete next.branchMap[bid];
          delete next.b[bid];
        }
        // v8->istanbul can occasionally produce "branch" entries that map to
        // declaration tokens (e.g. `const foo = ...`) rather than executable
        // control flow. These show up as permanently-uncovered branches even
        // when the module is exercised. Drop these artifacts to keep coverage
        // reporting meaningful.
        else if (
          bLoc?.type === 'branch' &&
          Array.isArray(bLoc?.locations) &&
          bLoc.locations.length === 1 &&
          Array.isArray(next.b?.[bid]) &&
          next.b[bid].length === 1 &&
          (looksLikeDeclarationSnippet(lines, startLine, endLine) ||
            isCommentOnlySnippet(lines, startLine, endLine) ||
            isReturnStatementSnippet(lines, startLine, endLine) ||
            isThrowStatementSnippet(lines, startLine, endLine) ||
            hasOptionalChainingSnippet(lines, startLine, endLine) ||
            hasIgnoreNextHintSnippet(lines, startLine, endLine) ||
            hasIgnoreNextHintSnippet(
              lines,
              Math.max(1, startLine - 10),
              endLine,
            ))
        ) {
          delete next.branchMap[bid];
          delete next.b[bid];
        }
      }
    }

    out[newKey] = next;
  }

  writeJson(outFile, out);
};

main();


