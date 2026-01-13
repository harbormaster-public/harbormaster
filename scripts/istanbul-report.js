#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const libCoverage = require('istanbul-lib-coverage');
const libReport = require('istanbul-lib-report');
const reports = require('istanbul-reports');

const usageAndExit = function (code) {
  console.error(
    [
      'Usage:',
      '  node scripts/istanbul-report.js <inputCoverageJson> <reportDir>',
      '    <summaryTxtFile> <summaryJsonFile>',
      '',
      'Environment:',
      '  COVERAGE_STATEMENTS, COVERAGE_BRANCHES, COVERAGE_FUNCTIONS,',
      '  COVERAGE_LINES (percent, default 100)',
    ].join('\n'),
  );
  process.exit(code);
};

const box = function (lines) {
  const safe = (lines || []).map((l) => String(l));
  const width = safe.reduce((m, l) => Math.max(m, l.length), 0);
  const top = `+${'-'.repeat(width + 2)}+`;
  const bot = `+${'-'.repeat(width + 2)}+`;
  const body = safe.map((l) => `| ${l.padEnd(width)} |`).join('\n');
  return `${top}\n${body}\n${bot}\n`;
};

const fmtLine = function (label, metric) {
  // metric: { total, covered, skipped, pct }
  const pct = Number.isFinite(metric.pct) ? metric.pct : 0;
  return (
    `${label.padEnd(10)}: ${String(pct).padStart(6)}% ` +
    `(${metric.covered}/${metric.total})`
  );
};

const getThreshold = function (name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
};

const main = function () {
  const inputJson = process.argv[2];
  const reportDir = process.argv[3];
  const summaryTxtFile = process.argv[4];
  const summaryJsonFile = process.argv[5];
  if (!inputJson || !reportDir || !summaryTxtFile || !summaryJsonFile) {
    usageAndExit(2);
  }

  const json = JSON.parse(fs.readFileSync(inputJson, 'utf8'));
  const coverageMap = libCoverage.createCoverageMap(json);

  fs.mkdirSync(reportDir, { recursive: true });
  fs.mkdirSync(path.dirname(summaryTxtFile), { recursive: true });
  fs.mkdirSync(path.dirname(summaryJsonFile), { recursive: true });

  const reportContext = libReport.createContext({
    dir: reportDir,
    coverageMap,
  });

  // Generate HTML + lcov into reportDir.
  reports.create('html').execute(reportContext);
  reports.create('lcovonly').execute(reportContext);

  // Generate json-summary into a temp location, then move to requested
  // filename.
  const tmpSummaryDir = fs.mkdtempSync(
    path.join(path.dirname(summaryJsonFile), 'istanbul-summary-'),
  );
  const summaryContext = libReport.createContext({
    dir: tmpSummaryDir,
    coverageMap,
  });
  reports.create('json-summary').execute(summaryContext);
  const generated = path.join(
    tmpSummaryDir,
    'coverage-summary.json',
  );
  if (!fs.existsSync(generated)) {
    console.error(
      `Expected json-summary at ${generated} but it was not generated.`,
    );
    process.exit(1);
  }
  fs.copyFileSync(generated, summaryJsonFile);
  fs.rmSync(tmpSummaryDir, { recursive: true, force: true });

  // Write a stable, simple text summary (and also print it).
  const summary = coverageMap.getCoverageSummary().toJSON();
  const lines = [
    'All files',
    fmtLine('Statements', summary.statements),
    fmtLine('Branches', summary.branches),
    fmtLine('Functions', summary.functions),
    fmtLine('Lines', summary.lines),
  ];
  const text = box(lines);

  fs.writeFileSync(summaryTxtFile, text, 'utf8');
  process.stdout.write(text);

  // Enforce thresholds.
  const tStatements = getThreshold('COVERAGE_STATEMENTS', 100);
  const tBranches = getThreshold('COVERAGE_BRANCHES', 100);
  const tFunctions = getThreshold('COVERAGE_FUNCTIONS', 100);
  const tLines = getThreshold('COVERAGE_LINES', 100);

  const failures = [];
  if (summary.statements.pct < tStatements) {
    failures.push(
      `statements ${summary.statements.pct}% < ${tStatements}%`,
    );
  }
  if (summary.branches.pct < tBranches) {
    failures.push(`branches ${summary.branches.pct}% < ${tBranches}%`);
  }
  if (summary.functions.pct < tFunctions) {
    failures.push(`functions ${summary.functions.pct}% < ${tFunctions}%`);
  }
  if (summary.lines.pct < tLines) {
    failures.push(`lines ${summary.lines.pct}% < ${tLines}%`);
  }

  if (failures.length) {
    const uncoveredFile = path.join(
      path.dirname(summaryTxtFile),
      'uncovered.json',
    );
    if (fs.existsSync(uncoveredFile)) {
      try {
        const uncovered = JSON.parse(fs.readFileSync(uncoveredFile, 'utf8'));
        const entries = (uncovered || []).slice(0, 25);
        if (entries.length) {
          const out = [];
          out.push('Uncovered (top 25):');
          for (const e of entries) {
            const fileLabel = path.relative(process.cwd(), e.file || '');
            const linesOnly = (e.statements || []).map((s) => s.line);
            const uniq = Array.from(new Set(linesOnly)).sort((a, b) => a - b);
            out.push(`${fileLabel}: ${uniq.join(', ')}`);
          }
          process.stderr.write(`\n${box(out)}`);
        }
      }
      catch (err) {
        const msg = err && err.stack ? err.stack : String(err);
        process.stderr.write(
          `\n${box(['Failed to render uncovered list:', msg])}`,
        );
      }
    }

    console.error(`Coverage thresholds not met: ${failures.join(', ')}`);
    process.exit(1);
  }
};

main();


