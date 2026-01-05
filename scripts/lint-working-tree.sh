#!/usr/bin/env bash
set -euo pipefail

# Lint JS files changed in the working tree (staged + unstaged).
#
# This is intended for local development, where you want `npm run lint`
# to reflect the files you are actively editing.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

changed_js_files() {
  {
    git diff --name-only --diff-filter=ACMR
    git diff --name-only --diff-filter=ACMR --cached
  } | grep -E '\.(js|cjs|mjs)$' | sort -u || true
}

FILES="$(changed_js_files)"
if [[ -z "${FILES}" ]]; then
  echo "lint: no staged/unstaged JS files to lint"
  exit 0
fi

echo "lint: linting staged/unstaged files"
echo "${FILES}"

# shellcheck disable=SC2086
ESLINT_USE_FLAT_CONFIG=false ./node_modules/.bin/eslint --max-warnings 0 ${FILES}


