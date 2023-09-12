#!/bin/bash

DATE=`date`
DOCS=`sed -n '/## Build Status/q;p' README.md`
COVERAGE_UPDATED=$'\n\n## Build Status\n\nLAST UPDATED: '$DATE$'\n'
COVERAGE_SUMMARY=`cat .coverage/summary.txt`

NEW_README=$DOCS$COVERAGE_UPDATED$COVERAGE_SUMMARY

DIFF=`git diff --name-only HEAD HEAD~1`
DIFF_COUNT=`echo "$DIFF" | wc -l`

if [ "$DIFF_COUNT" = 1 ] && [ "$DIFF" = "README.md" ]; then
  echo "README update detected as only diff, not updating it further."
elif [ "$BUILD" = 1 ]; then
  echo "Updating README with build status."
  echo $'\nLATEST BUILD: '$DATE >> README.md
else
  echo "Updating README with coverage status."
  echo "$NEW_README" > README.md
fi
