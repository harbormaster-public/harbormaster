#!/bin/bash
set -e

ip_address=$(awk 'END{print $1}' /etc/hosts)

echo "$ip_address localhost localhost.localdomain harbormaster" >> /etc/hosts

# Update node_modules based on what's in package.json, e.g. git-pull
if [ -f /harbormaster/bundle/programs/server/npm-shrinkwrap.json ]; then
  rm /harbormaster/bundle/programs/server/npm-shrinkwrap.json
fi
npm install
node /harbormaster/bundle/main.js
