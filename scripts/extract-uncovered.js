/**
 * Extract uncovered statements/branches/functions from an Istanbul coverage
 * JSON (postprocessed out.json) into a compact report used during coverage
 * work.
 *
 * Usage:
 *   node scripts/extract-uncovered.js <inFile> <outFile>
 *
 * Output format:
 * [
 *   {
 *     file: "/abs/path/to/file.js",
 *     statements: [{ line, col, endLine, endCol }, ...],
 *     functions: [{ line, col, endLine, endCol }, ...],
 *     branches: [{ type, line, col, endLine, endCol }, ...]
 *   }
 * ]
 */

const fs = require('node:fs');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, 2));

const locToRange = (loc) => ({
  line: loc?.start?.line,
  col: loc?.start?.column,
  endLine: loc?.end?.line,
  endCol: loc?.end?.column,
});

const main = () => {
  const inFile = process.argv[2];
  const outFile = process.argv[3];
  if (!inFile || !outFile) {
    console.error(
      'Usage: node scripts/extract-uncovered.js <inFile> <outFile>',
    );
    process.exit(1);
  }

  const cov = readJson(inFile);
  const out = [];

  for (const [file, fc] of Object.entries(cov)) {
    const statements = [];
    const functions = [];
    const branches = [];

    for (const [sid, count] of Object.entries(fc.s || {})) {
      if (count !== 0) continue;
      const loc = fc.statementMap?.[sid];
      if (!loc?.start) continue;
      statements.push(locToRange(loc));
    }

    for (const [fid, count] of Object.entries(fc.f || {})) {
      if (count !== 0) continue;
      const loc = fc.fnMap?.[fid]?.loc;
      if (!loc?.start) continue;
      functions.push(locToRange(loc));
    }

    for (const [bid, counts] of Object.entries(fc.b || {})) {
      const bm = fc.branchMap?.[bid];
      const locs = bm?.locations || [];
      (counts || []).forEach((count, idx) => {
        if (count !== 0) return;
        const loc = locs[idx] || bm?.loc;
        if (!loc?.start) return;
        branches.push({ type: bm?.type || 'branch', ...locToRange(loc) });
      });
    }

    if (statements.length || functions.length || branches.length) {
      out.push({
        file,
        statements,
        functions,
        branches,
      });
    }
  }

  out.sort((a, b) => String(a.file).localeCompare(String(b.file)));
  writeJson(outFile, out);
};

main();


