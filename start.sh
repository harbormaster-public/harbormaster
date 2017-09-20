#!/bin/bash

ip_address=$(awk 'END{print $1}' /etc/hosts)

echo "$ip_address localhost localhost.localdomain harbormaster" >> /etc/hosts

service sendmail start
node /harbormaster/bundle/main.js
