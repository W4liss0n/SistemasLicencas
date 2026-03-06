# Deployment - Configuracao

## Variaveis obrigatorias
| Variavel | Descricao |
|---|---|
| `DATABASE_URL` | URL do PostgreSQL |
| `REDIS_URL` | URL do Redis |
| `JWT_SECRET` | Segredo para tokens internos |

## Variaveis com default
| Variavel | Default | Descricao |
|---|---|---|
| `NODE_ENV` | `development` | Ambiente |
| `PORT` | `3001` | Porta HTTP |
| `API_PREFIX` | `/api/v2` | Prefixo global |
| `AUTH_PASSWORD_PEPPER` | `change-me-auth-pepper-please` | Pepper da verificacao de senha |
| `REQUEST_TIMEOUT_MS` | `3000` | Timeout global de request |
| `IDEMPOTENCY_TTL_HOURS` | `24` | Janela de replay idempotente |
| `LICENSE_ENGINE_STRATEGY` | `auto` | Seleciona engine (`auto`, `fake`, `prisma`) |
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
```

Regras:
- `ADMIN_INTERNAL_API_KEY` e segredo de servidor/proxy; nunca usar prefixo `VITE_`.
- O navegador nunca envia `X-Internal-Api-Key` diretamente; o header e injetado no proxy do Vite.
- Em producao, o mesmo padrao deve ser replicado em reverse proxy/edge.
- A flag de mutacoes para producao deve ser controlada por runtime config (`ADMIN_WEB_ENABLE_MUTATIONS`) para permitir rollback sem rebuild.

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
- `INTERNAL_ADMIN_API_KEYS`
- `ADMIN_INTERNAL_API_KEY`
- `ADMIN_WEB_ENABLE_MUTATIONS`
- `CF_API_TOKEN`
- `CF_ZONE_ID`
- `CF_RECORD_NAME`
- `JWT_SECRET`
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
