#!/bin/sh

echo "`date`: Running pre-push hook."
npm run test
npm run test:e2e
echo "`date`: Test complete.  Continuing with push."