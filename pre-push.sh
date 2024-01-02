#!/bin/sh
set -e

echo "`date`: Running pre-push hook."
npm run coverage
npm run test:e2e
echo "`date`: Test complete.  Continuing with push."