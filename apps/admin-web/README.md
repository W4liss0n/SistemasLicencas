# Admin Web v2

Interface interna para operacao de licencas do `sistema-licencas-v2`.

## Variaveis de ambiente

```env
ADMIN_WEB_API_TARGET=http://localhost:3001
ADMIN_INTERNAL_API_KEY=change-me-internal-key
ADMIN_WEB_PORT=4173
VITE_ADMIN_WEB_ENABLE_MUTATIONS=false
```

Notas:
- `ADMIN_INTERNAL_API_KEY` e lida apenas pelo servidor Vite (proxy), nunca pelo browser.
- As chamadas do frontend usam exclusivamente `/admin-api/*`.
- Para producao em container, a flag de mutacao usa runtime config em `config.js` via `ADMIN_WEB_ENABLE_MUTATIONS=true|false`.

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
- `TLS_CERT_PATH`
- `TLS_KEY_PATH`
