#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

ESLINT_USE_FLAT_CONFIG=false ./node_modules/.bin/eslint --fix --max-warnings 0 \
  "client/**/*.js" \
  "server/**/*.js" \
  "imports/**/*.js" \
  "scripts/**/*.js" \
  "*.js" \
  "*.mjs"


