#!/bin/sh
set -eu

: "${ADMIN_WEB_ENABLE_MUTATIONS:=false}"
: "${ADMIN_AUTH_ENABLED:=false}"
: "${ADMIN_AUTH_ISSUER_URL:=}"
: "${ADMIN_AUTH_CLIENT_ID:=}"
: "${ADMIN_AUTH_AUDIENCE:=}"
: "${ADMIN_AUTH_SCOPES:=openid profile email admin:access}"

envsubst '${ADMIN_WEB_ENABLE_MUTATIONS} ${ADMIN_AUTH_ENABLED} ${ADMIN_AUTH_ISSUER_URL} ${ADMIN_AUTH_CLIENT_ID} ${ADMIN_AUTH_AUDIENCE} ${ADMIN_AUTH_SCOPES}' \
  < /opt/config.js.template \
  > /usr/share/nginx/html/config.js
