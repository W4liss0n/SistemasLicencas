# Deployment - Configuracao

## Variaveis obrigatorias
| Variavel | Descricao |
|---|---|
| `DATABASE_URL` | URL do PostgreSQL |
| `REDIS_URL` | URL do Redis |
| `JWT_SECRET` | Segredo para tokens internos |
| `ACCESS_JWT_SECRET` | Segredo para tokens de acesso; em producao e obrigatorio, nao pode ficar com placeholder e deve ser diferente de `JWT_SECRET` |
| `REFRESH_JWT_SECRET` | Segredo para refresh tokens; em producao e obrigatorio, nao pode ficar com placeholder e deve ser diferente de `JWT_SECRET` e de `ACCESS_JWT_SECRET` |
| `AUTH_PASSWORD_PEPPER` | Pepper de credenciais; em producao nao pode ficar com placeholder |
| `CORS_ALLOWED_ORIGINS` | Origens HTTPS autorizadas para CORS em producao |

Obrigatorias apenas quando `ADMIN_AUTH_ENABLED=true`:

| Variavel | Descricao |
|---|---|
| `ADMIN_AUTH_ISSUER_URL` | Issuer do tenant Auth0 usado pelo painel administrativo |
| `ADMIN_AUTH_AUDIENCE` | Identifier da API Auth0 que emite o access token do painel administrativo |

## Variaveis com default
| Variavel | Default | Descricao |
|---|---|---|
| `NODE_ENV` | `development` | Ambiente |
| `PORT` | `3001` | Porta HTTP |
| `API_PREFIX` | `/api/v2` | Prefixo global |
| `AUTH_PASSWORD_PEPPER` | `change-me-auth-pepper-please` | Pepper da verificacao de senha em dev/test; obrigatorio trocar em producao |
| `REQUEST_TIMEOUT_MS` | `3000` | Timeout global de request |
| `IDEMPOTENCY_TTL_HOURS` | `24` | Janela de replay idempotente |
| `LICENSE_ENGINE_STRATEGY` | `auto` | Seleciona engine (`auto`, `fake`, `prisma`) |
| `ADMIN_AUTH_ENABLED` | `false` | Exige access token Auth0 nos endpoints internos admin quando habilitado |
| `ADMIN_AUTH_REQUIRED_SCOPES` | `admin:access` | Scopes/permissoes exigidos no access token Auth0 admin |
| `ADMIN_AUTH_CLOCK_TOLERANCE_SECONDS` | `60` | Tolerancia de relogio na validacao JWT Auth0 |
| `OTEL_ENABLED` | `false` | Habilita tracing |
| `OTEL_SERVICE_NAME` | `sistema-licencas-v2` | Nome do servico em traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | vazio | Endpoint OTLP HTTP |
| `METRICS_ENABLED` | `false` | Habilita endpoint de metricas |
| `METRICS_PATH` | `/metrics` | Caminho relativo de metricas sob prefixo da API |

Nota OTel:
- `OTEL_EXPORTER_OTLP_ENDPOINT` pode ser informado como base URL (o path de traces e resolvido pelo exporter HTTP).
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` aceita endpoint completo e, quando definido, prevalece para traces.

Nota License Engine Strategy:
- `auto`: usa `fake` em `NODE_ENV=test` e `prisma` em `development/production`.
- `fake`: permitido apenas fora de `production`.
- `prisma`: forca adapter Prisma em qualquer ambiente (incluindo `test`).

Nota CORS:
- em `production`, `CORS_ALLOWED_ORIGINS` e obrigatoria e deve listar origins HTTPS separados por virgula;
- `*` nao e aceito com credenciais;
- em `development` e `test`, quando a variavel fica vazia, o servidor continua permissivo para facilitar o fluxo local.

Nota Auth0 Admin:
- `ADMIN_AUTH_ENABLED=false` preserva o fluxo atual com Basic Auth + chave interna no gateway;
- com `ADMIN_AUTH_ENABLED=true`, o gateway continua injetando `X-Internal-Api-Key`, mas a API tambem exige `Authorization: Bearer <access_token>`;
- o access token deve ser JWT RS256 emitido pelo `ADMIN_AUTH_ISSUER_URL`, com `aud` igual a `ADMIN_AUTH_AUDIENCE` e scope/permissao `admin:access` por padrao;
- para Auth0 RBAC, habilite RBAC na API e atribua a permissao `admin:access` ao operador ou role.

Runbook de rollout:
- [Rollout da estrategia do License Engine](./license-engine-rollout.md)

## Checklist operacional OTel (nao-dev)
Consulte o guia completo para `staging` e `production`:
- [Checklist OpenTelemetry nao-dev](./opentelemetry-checklist.md)

## Exemplo local minimo
```env
NODE_ENV=development
PORT=3001
API_PREFIX=/api/v2
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/sistema_licencas_v2
REDIS_URL=redis://localhost:6380
JWT_SECRET=change-me-at-least-32-chars-long
AUTH_PASSWORD_PEPPER=change-me-auth-pepper-at-least-16-chars
IDEMPOTENCY_TTL_HOURS=24
LICENSE_ENGINE_STRATEGY=auto
METRICS_ENABLED=true
METRICS_PATH=/metrics
```

## Interface web interna (`admin-web`)

A interface interna do backoffice roda em `apps/admin-web` e consome apenas `/admin-api/*`.

Variaveis para dev local:

```env
ADMIN_WEB_API_TARGET=http://localhost:3001
ADMIN_INTERNAL_API_KEY=change-me-internal-key
ADMIN_WEB_PORT=4173
ADMIN_WEB_PREVIEW_PORT=4273
VITE_ADMIN_WEB_ENABLE_MUTATIONS=true
VITE_ADMIN_AUTH_ENABLED=false
VITE_ADMIN_AUTH_ISSUER_URL=https://tenant.example.auth0.com/
VITE_ADMIN_AUTH_CLIENT_ID=admin-web-client-id
VITE_ADMIN_AUTH_AUDIENCE=https://api.example.com/admin
VITE_ADMIN_AUTH_SCOPES=openid profile email admin:access
```

Regras:
- `ADMIN_INTERNAL_API_KEY` e segredo de servidor/proxy; nunca usar prefixo `VITE_`.
- O navegador nunca envia `X-Internal-Api-Key` diretamente; o header e injetado no proxy do Vite.
- Em producao, o mesmo padrao deve ser replicado em reverse proxy/edge.
- A flag de mutacoes para producao deve ser controlada por runtime config (`ADMIN_WEB_ENABLE_MUTATIONS`) para permitir rollback sem rebuild.
- Em producao com Auth0, `ADMIN_AUTH_CONNECT_SRC` deve listar a origin Auth0 permitida pelo CSP, por exemplo `https://tenant.example.auth0.com`.

Comandos:

```bash
cd SistemaLicencas
npm run admin-web:dev
npm run admin-web:build
npm run admin-web:test
npm run admin-web:e2e
```

## Geracao e validacao de contrato
```bash
npm run openapi:generate
npm run openapi:validate
```

## Deploy full-stack em Docker (Windows host + Cloudflare DDNS)

Arquivo de orquestracao:
- `docker-compose.prod.yml`

Variaveis esperadas (base: `.env.prod.example`):
- `PUBLIC_DOMAIN`
- `BASIC_AUTH_USER`
- `POSTGRES_PASSWORD`
- `INTERNAL_ADMIN_API_KEYS`
- `ADMIN_INTERNAL_API_KEY`
- `CORS_ALLOWED_ORIGINS`
- `ADMIN_WEB_ENABLE_MUTATIONS`
- `ADMIN_AUTH_ENABLED`
- `ADMIN_AUTH_ISSUER_URL`
- `ADMIN_AUTH_AUDIENCE`
- `ADMIN_AUTH_REQUIRED_SCOPES`
- `ADMIN_AUTH_CLIENT_ID`
- `ADMIN_AUTH_SCOPES`
- `ADMIN_AUTH_CONNECT_SRC`
- `CF_API_TOKEN`
- `CF_ZONE_ID`
- `CF_RECORD_NAME`
- `JWT_SECRET`
- `ACCESS_JWT_SECRET`
- `REFRESH_JWT_SECRET`
- `AUTH_PASSWORD_PEPPER`
- `DATABASE_URL`
- `REDIS_URL`

Servicos previstos:
- `postgres`
- `redis`
- `api`
- `admin-gateway` (NGINX com Basic Auth + proxy de `/admin-api/*` + proxy publico `/api/v2/*`)
- `prometheus`
- `alertmanager`
- `ddns` (Cloudflare updater)

Regras de exposicao:
- Expor apenas `443` no host.
- Nao expor `3001`, `5432`, `6379` externamente.
- Bloquear acesso externo direto a `/api/v2/internal/admin/*`.
- Bloquear acesso externo a `/api/v2/metrics` no gateway.

Comandos de deploy:

```bash
cd SistemaLicencas
cp .env.prod.example .env.prod
# ajustar segredos e dominio em .env.prod
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Smoke test de borda:

```bash
GATEWAY_BASE_URL=https://localhost \
GATEWAY_BASIC_AUTH_USER=admin \
GATEWAY_BASIC_AUTH_PASSWORD=change-me \
GATEWAY_INSECURE_TLS=true \
npm run gateway:smoke
```

## Limpeza de idempotencia expirada
Comandos operacionais:

```bash
npm run idempotency:cleanup
npm run idempotency:cleanup:dry-run
```

Flags suportadas pelo script:
- `--dry-run`
- `--batch-size <numero>` (default `1000`)
- `--max-batches <numero>` (default `100`)

Agendamento diario:
- workflow: `.github/workflows/idempotency-cleanup.yml`
- frequencia: diaria (UTC `0 3 * * *`)
- segredo requerido: `IDEMPOTENCY_CLEANUP_DATABASE_URL` (mapeado para `DATABASE_URL` no job)

Execucao manual:
- acionar `workflow_dispatch` no workflow `idempotency-cleanup`
- opcionalmente habilitar `dry_run=true` para diagnostico sem delecao
