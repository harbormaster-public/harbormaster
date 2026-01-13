#!/usr/bin/env bash
set -euo pipefail

# Repo root (script is in ./scripts).
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Meteor test port (override via env).
TEST_PORT="${TEST_PORT:-4041}"

# Coverage output locations (all under ./.coverage).
COVERAGE_DIR="${ROOT_DIR}/.coverage"
V8_DIR="${COVERAGE_DIR}/v8"
NYC_TMP_DIR="${COVERAGE_DIR}/.nyc_output"
REPORT_DIR="${COVERAGE_DIR}/summary"
# Persist Meteor's test build output so V8 coverage paths are stable.
TEST_APP_DIR="${ROOT_DIR}/.meteor-test-app"

# Coverage thresholds (override via env).
COVERAGE_STATEMENTS="${COVERAGE_STATEMENTS:-100}"
COVERAGE_BRANCHES="${COVERAGE_BRANCHES:-100}"
COVERAGE_FUNCTIONS="${COVERAGE_FUNCTIONS:-100}"
COVERAGE_LINES="${COVERAGE_LINES:-100}"

# Clean previous artifacts.
rm -rf "${V8_DIR}" "${NYC_TMP_DIR}" "${REPORT_DIR}" "${TEST_APP_DIR}"
rm -f "${COVERAGE_DIR}/summary.txt" "${COVERAGE_DIR}/uncovered.json" "${COVERAGE_DIR}/summary.json"
mkdir -p "${V8_DIR}" "${NYC_TMP_DIR}"

# Enable Node's V8 coverage output and keep Vite HMR off during tests.
export NODE_V8_COVERAGE="${V8_DIR}"
export NO_HMR="${NO_HMR:-1}"
# Suppress noisy Node experimental warnings from Meteor/Vite toolchain during tests.
# Preserve any existing NODE_OPTIONS from the environment.
export NODE_OPTIONS="${NODE_OPTIONS:-} --no-warnings=ExperimentalWarning"

cd "${ROOT_DIR}"

# Pick a free port if the default is in use.
# (We can have a dev server or parallel test run active.)
is_port_open() {
  (echo >/dev/tcp/127.0.0.1/"$1") >/dev/null 2>&1
}
while is_port_open "${TEST_PORT}"; do
  TEST_PORT="$((TEST_PORT + 1))"
done

# Run Meteor server tests once, emitting V8 coverage JSON into $NODE_V8_COVERAGE.
meteor test \
  --port="${TEST_PORT}" \
  --driver-package meteortesting:mocha \
  --once \
  --test-app-path "${TEST_APP_DIR}"

# Rewrite Meteor/V8 "meteor://💻app/..." URLs into real filesystem paths.
node scripts/normalize-v8-coverage.js
# Create symlinks so Istanbul HTML can open "meteor:/💻app/..." sources.
node scripts/setup-meteor-source-aliases.js

# Convert V8 coverage -> Istanbul JSON (into $NYC_TMP_DIR) with include/exclude rules.
./node_modules/.bin/c8 report \
  --allowExternal \
  --omit-relative=false \
  --exclude-after-remap \
  --include "**/imports/**" \
  --exclude "**/node_modules/**" \
  --exclude "${HOME}/.meteor/**" \
  --exclude "**/test-helpers/**" \
  --exclude "**/*.{test,spec}.{js,cjs,mjs,ts,tsx,jsx}" \
  --exclude "**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx}" \
  --exclude "**/__tests__/**" \
  --temp-directory "${V8_DIR}" \
  --reports-dir "${NYC_TMP_DIR}" \
  --reporter json \
  >/dev/null

# Normalize filename for nyc and apply our post-processing.
# (nyc expects the coverage JSON to live in $NYC_TMP_DIR.)
if [[ -f "${NYC_TMP_DIR}/coverage-final.json" ]]; then
  mv "${NYC_TMP_DIR}/coverage-final.json" "${NYC_TMP_DIR}/out.json"
fi

# Fix file keys (Meteor build paths -> repo paths) and drop import-only "statements".
node scripts/postprocess-istanbul-coverage.js "${NYC_TMP_DIR}/out.json" "${NYC_TMP_DIR}/out.json"

# Write a machine-readable "what's uncovered" list from the post-processed JSON.
node scripts/extract-uncovered.js "${NYC_TMP_DIR}/out.json" "${COVERAGE_DIR}/uncovered.json"

# Generate final HTML/lcov reports, a text summary, a JSON summary, and enforce thresholds.
node scripts/istanbul-report.js \
  "${NYC_TMP_DIR}/out.json" \
  "${REPORT_DIR}" \
  "${COVERAGE_DIR}/summary.txt" \
  "${COVERAGE_DIR}/summary.json"


