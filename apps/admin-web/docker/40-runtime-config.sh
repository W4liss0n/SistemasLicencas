#!/bin/sh
set -eu

envsubst '${ADMIN_WEB_ENABLE_MUTATIONS}' \
  < /opt/config.js.template \
  > /usr/share/nginx/html/config.js
