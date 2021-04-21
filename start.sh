#!/bin/bash
set -e

ip_address=$(awk 'END{print $1}' /etc/hosts)

echo "$ip_address localhost localhost.localdomain harbormaster" >> /etc/hosts

node /harbormaster/bundle/main.js
