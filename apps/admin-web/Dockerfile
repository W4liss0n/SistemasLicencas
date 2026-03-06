FROM node:22-alpine AS build
WORKDIR /workspace

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
RUN npm ci --workspace=admin-web

COPY . .
RUN npm run admin-web:build

FROM nginx:1.27-alpine AS runtime

ENV PUBLIC_DOMAIN=localhost \
    BASIC_AUTH_REALM="Admin Backoffice v2" \
    ADMIN_INTERNAL_API_KEY=change-me-internal-key \
    ADMIN_WEB_ENABLE_MUTATIONS=false \
    TLS_CERT_PATH=/etc/nginx/certs/origin.crt \
    TLS_KEY_PATH=/etc/nginx/certs/origin.key \
    NGINX_ENVSUBST_FILTER='PUBLIC_DOMAIN|BASIC_AUTH_REALM|ADMIN_INTERNAL_API_KEY|TLS_CERT_PATH|TLS_KEY_PATH'

RUN rm -f /etc/nginx/conf.d/default.conf \
    && mkdir -p /etc/nginx/auth /etc/nginx/certs

COPY --from=build /workspace/apps/admin-web/dist /usr/share/nginx/html
COPY apps/admin-web/docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY apps/admin-web/docker/config.js.template /opt/config.js.template
COPY apps/admin-web/docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh

RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 443