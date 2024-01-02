#!/bin/sh
set -e

echo "`date`: Running pre-commit hook."
npm run test
echo "`date`: Test complete.  Updating README with status."
./update_build_status.sh
