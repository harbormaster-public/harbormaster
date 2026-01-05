#!/usr/bin/env bash
set -euo pipefail

# Lint only the JS files changed in commits relative to a base ref.
#
# Usage:
#   bash scripts/lint-changed.sh [BASE_REF]
#
# BASE_REF can be:
# - a git ref (e.g. origin/master, @{u})
# - a commit SHA (e.g. from CI: github.event.before)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

BASE_REF="${1:-}"

if [[ -z "${BASE_REF}" ]]; then
  if git rev-parse --verify --quiet '@{u}' >/dev/null; then
    BASE_REF='@{u}'
  elif git rev-parse --verify --quiet 'origin/master' >/dev/null; then
    BASE_REF='origin/master'
  fi
fi

if [[ -n "${BASE_REF}" ]]; then
  if ! git rev-parse --verify --quiet "${BASE_REF}" >/dev/null; then
    BASE_REF=''
  fi
fi

if [[ -z "${BASE_REF}" ]]; then
  if git rev-parse --verify --quiet 'HEAD~1' >/dev/null; then
    BASE_REF='HEAD~1'
  fi
fi

changed_js_files() {
  if [[ -n "${BASE_REF}" ]]; then
    git diff --name-only --diff-filter=ACMR "${BASE_REF}...HEAD"
  else
    git diff --name-only --diff-filter=ACMR --cached
  fi | grep -E '\.(js|cjs|mjs)$' || true
}

FILES="$(changed_js_files)"
if [[ -z "${FILES}" ]]; then
  echo "lint: no changed JS files to lint (commit diff)"
  exit 0
fi

echo "lint: linting changed files relative to ${BASE_REF:-'(staged changes)'}"
echo "${FILES}"

# shellcheck disable=SC2086
ESLINT_USE_FLAT_CONFIG=false ./node_modules/.bin/eslint --max-warnings 0 ${FILES}


