#!/bin/bash
set -e

depot=~/.harbormaster/depot
harbors=~/.harbormaster/harbors
default=(sleep ssh other-lanes email javascript)
github="git@github.com:strictlyskyler"

if [ ! -d $depot ]; then
  mkdir -p $depot
  echo "$depot created."
fi

if [ ! -d $harbors ]; then
  mkdir -p $harbors
  echo "$harbors created."
fi

for harbor in "${default[@]}"; do
  if [ ! -d $depot/$harbor ]; then
    echo "Getting $github/harbormaster-$harbor..."
    git clone $github/harbormaster-$harbor $depot/$harbor
  else
    echo "$depot/$harbor already exists."
  fi

  cp $depot/$harbor/$harbor.js $harbors/$harbor.js
  if [ -d $depot/$harbor/$harbor ]; then
    cp -R $depot/$harbor/$harbor $harbors/$harbor
  fi
done

echo "Installing git hooks."
cp pre-commit.sh .git/hooks/pre-commit
cp pre-push.sh .git/hooks/pre-push
