#!/bin/bash
set -e

depot=~/.harbormaster/depot
harbors=~/.harbormaster/harbors

if [ ! -d "$depot" ]; then
  mkdir -p "$depot"
  echo "$depot created."
fi

if [ ! -d "$harbors" ]; then
  mkdir -p "$harbors"
  echo "$harbors created."
fi

echo "Installing git hooks."
cp pre-commit.sh .git/hooks/pre-commit
cp pre-push.sh .git/hooks/pre-push
