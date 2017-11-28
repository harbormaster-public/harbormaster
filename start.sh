#!/bin/bash

ip_address=$(awk 'END{print $1}' /etc/hosts)

echo "$ip_address localhost localhost.localdomain harbormaster" >> /etc/hosts

if [ -f /harbormaster/bundle/programs/server/npm-shrinkwrap.json ]; then
  rm /harbormaster/bundle/programs/server/npm-shrinkwrap.json
fi
npm install
node /harbormaster/bundle/main.js
