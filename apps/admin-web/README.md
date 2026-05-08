# Admin Web v2

Interface interna para operacao de licencas do `sistema-licencas-v2`.

## Variaveis de ambiente

```env
ADMIN_WEB_API_TARGET=http://localhost:3001
ADMIN_INTERNAL_API_KEY=change-me-internal-key
ADMIN_WEB_PORT=4173
VITE_ADMIN_WEB_ENABLE_MUTATIONS=false
VITE_ADMIN_AUTH_ENABLED=false
VITE_ADMIN_AUTH_ISSUER_URL=https://tenant.example.auth0.com/
VITE_ADMIN_AUTH_CLIENT_ID=admin-web-client-id
VITE_ADMIN_AUTH_AUDIENCE=https://api.example.com/admin
VITE_ADMIN_AUTH_SCOPES=openid profile email admin:access
```

Notas:
- `ADMIN_INTERNAL_API_KEY` e lida apenas pelo servidor Vite (proxy), nunca pelo browser.
- As chamadas do frontend usam exclusivamente `/admin-api/*`.
- Para producao em container, a flag de mutacao usa runtime config em `config.js` via `ADMIN_WEB_ENABLE_MUTATIONS=true|false`.
- Quando `ADMIN_AUTH_ENABLED=true`, o login usa Auth0 Authorization Code + PKCE. O browser envia o token em `X-Admin-Authorization` para nao conflitar com Basic Auth; o proxy repassa para a API como `Authorization: Bearer`.

## Comandos

```bash
npm install
npm run dev
npm run build
npm run test
npm run test:e2e
```

## Imagem Docker (gateway unico)

```bash
docker build -t sistema-licencas-admin-web .
```

Variaveis de runtime no container:
- `PUBLIC_DOMAIN`
- `BASIC_AUTH_REALM`
- `ADMIN_INTERNAL_API_KEY`
- `ADMIN_WEB_ENABLE_MUTATIONS`
- `ADMIN_AUTH_ENABLED`
- `ADMIN_AUTH_ISSUER_URL`
- `ADMIN_AUTH_CLIENT_ID`
- `ADMIN_AUTH_AUDIENCE`
- `ADMIN_AUTH_SCOPES`
- `ADMIN_AUTH_CONNECT_SRC`
- `TLS_CERT_PATH`
- `TLS_KEY_PATH`
