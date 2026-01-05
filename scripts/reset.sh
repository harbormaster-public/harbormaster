#!/usr/bin/env bash
set -euo pipefail

# Reset the local Meteor database and clear .meteor/local
#
# Usage:
#   bash scripts/reset.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

echo "Resetting Meteor database..."
meteor reset

echo "Clearing .meteor/local..."
rm -rf .meteor/local

echo "Reset complete!"

