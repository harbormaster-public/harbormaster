#!/bin/sh

echo "`date`: Running pre-commit hook."
npm run test
echo "`date`: Test complete.  Updating README with status."
./update_build_status.sh
git add README.md
git commit --amend -C HEAD --no-verify