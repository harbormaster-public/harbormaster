#!/bin/sh

echo "`date`: Running pre-commit hook."
npm run test
echo "`date`: Test complete.  Continuing with commit."