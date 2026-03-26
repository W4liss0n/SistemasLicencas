# Sistema Licencas - Documentacao Tecnica

Data de atualizacao: 2026-03-05

## Escopo canonico
Esta documentacao descreve o runtime publico do rewrite `sistema-licencas-v2`.
O legado `sistema-licencas` permanece apenas para compatibilidade e nao define contrato novo.

## Endpoints publicos v2
### Licensing runtime
- `POST /api/v2/license/authenticate`
- `POST /api/v2/licenses/validate`
- `POST /api/v2/licenses/activate`
- `POST /api/v2/licenses/heartbeat`
- `POST /api/v2/licenses/transfer`
- `POST /api/v2/licenses/deactivate`

### Auth de usuario final (OIDC + offline)
- `GET /api/v2/auth/oidc/config`
- `POST /api/v2/auth/login`
- `POST /api/v2/auth/refresh`
- `POST /api/v2/auth/logout`
- `GET /api/v2/auth/me`
- `GET /.well-known/jwks.json`

### Operacao e observabilidade
- `GET /api/v2/health`
- `GET /api/v2/metrics` (somente quando `METRICS_ENABLED=true`)

## APIs internas de operacao
### Licensing admin
- `POST /api/v2/internal/admin/licenses`
- `PATCH /api/v2/internal/admin/licenses/:licenseKey`
- `POST /api/v2/internal/admin/licenses/:licenseKey/renew`
- `POST /api/v2/internal/admin/licenses/:licenseKey/block`
- `POST /api/v2/internal/admin/licenses/:licenseKey/unblock`
- `POST /api/v2/internal/admin/licenses/:licenseKey/cancel`
- `GET /api/v2/internal/admin/licenses/:licenseKey`
- `GET /api/v2/internal/admin/operational-summary`

### Admin de usuario final
- `POST /api/v2/internal/admin/users`
- `PATCH /api/v2/internal/admin/users/:id`
- `POST /api/v2/internal/admin/users/:id/block`
- `POST /api/v2/internal/admin/users/:id/unblock`

### Catalogo administrativo
- `POST /api/v2/internal/admin/programs`
- `GET /api/v2/internal/admin/programs`
- `POST /api/v2/internal/admin/plans`
- `PATCH /api/v2/internal/admin/plans/:planId`
- `GET /api/v2/internal/admin/plans`
- `GET /api/v2/internal/admin/customers`
- `GET /api/v2/internal/admin/customers/:customerId`
- `POST /api/v2/internal/admin/customers`
- `POST /api/v2/internal/admin/customers/onboard`

## Regras transversais
- Header `X-Program-Id` obrigatorio em licensing e nos endpoints `login`, `refresh`, `logout`, `me` de auth.
- Header `X-Internal-Api-Key` obrigatorio em todas as APIs internas.
- Header `Idempotency-Key` obrigatorio em:
  - `activate`, `transfer`, `deactivate`
  - mutacoes internas de licensing: `POST /api/v2/internal/admin/licenses`, `PATCH /api/v2/internal/admin/licenses/:licenseKey`, `renew`, `block`, `unblock`, `cancel`
  - mutacoes internas de planos: `POST /api/v2/internal/admin/plans` e `PATCH /api/v2/internal/admin/plans/:planId`
- Erros retornam `application/problem+json` com `trace_id` e `x-request-id`.

## Pre-requisitos
- Node.js com `npm` disponivel para backend e `admin-web`.
- PostgreSQL e Redis locais, ou stack local via Docker Compose.
- Docker daemon ativo para:
  - stack local (`docker compose up`) opcional;
  - gate de compatibilidade legado (`npm run test:legacy:local`).
- Python `>=3.10` somente para uso do SDK Python.

## Dependencias locais minimas
Opcao 1 (recomendada): subir dependencias com Docker.
```bash
cd SistemaLicencas
docker compose up -d postgres redis
```

Opcao 2: usar PostgreSQL + Redis nativos na maquina.

Variaveis obrigatorias e defaults:
- [Configuracao de deploy e runtime](./deployment/configuration.md)
- [Arquivo base local (`.env.example`)](../apps/api/.env.example)

## Navegacao
- [Indice geral](./INDEX.md)
- [API Auth v2 (OIDC + offline)](./api/auth/README.md)
- [API Licensing runtime](./api/license/README.md)
- [Design de API v2](./api/rewrite-api-design.md)
- [API interna (admin backoffice)](./api/internal/README.md)
- [Provisionamento interno de licencas](./api/internal/admin-license-provisioning.md)
- [Arquitetura](./architecture/overview.md)
- [Fluxo de dados](./architecture/data-flow.md)
- [Estado da validacao do rewrite](./architecture/rewrite-do-zero-validacao.md)
- [Banco de dados](./database/schema.md)
- [Historico de migrations](./database/migrations.md)
- [Arquitetura de dados v2](./database/rewrite-database-architecture.md)
- [Seguranca - fingerprint](./security/fingerprint.md)
- [Seguranca - rate limiting e idempotencia](./security/rate-limiting.md)
- [Seguranca - modelo offline de login](./security/offline-login-model.md)
- [Deploy](./deployment/configuration.md)
- [Deploy local com Docker](./deployment/docker.md)
- [Checklist OTel nao-dev](./deployment/opentelemetry-checklist.md)
- [Rollout License Engine](./deployment/license-engine-rollout.md)
- [Roadmap v2 (feito x faltante)](./rewrite-v2/roadmap-v2.md)
- [Matriz de compatibilidade v1 x v2](./rewrite-v2/compatibility-matrix.generated.md)
- [Mini-spec Interface Web Interna](./rewrite-v2/mini-spec-fase11-interface-web-interna.md)
- [Mini-spec Hardening Interface Web Interna (fase 12)](./rewrite-v2/mini-spec-fase12-hardening-interface-web-interna.md)
- [Arquitetura de erros](./ERROR_MESSAGES_ARCHITECTURE.md)
- [Operacao v2](./rewrite-v2/README.md)
- [Indice ADR](./adr/README.md)

## Fluxo rapido local
```bash
cd SistemaLicencas
npm install
cp apps/api/.env.example apps/api/.env
npm run prisma:migrate:dev
npm run prisma:seed
npm run dev
```

Observacao:
- `npm run dev` e o entrypoint recomendado para subir API + admin-web no mesmo terminal.
- Quando precisar isolar os processos, use `npm run api:dev` ou `npm run admin-web:dev`.

## Estrategia de migrations (dev x CI/prod)
- Desenvolvimento local: `npm run prisma:migrate:dev`
- CI e producao: `npm run prisma:migrate:deploy`

Regra operacional:
- nao usar `migrate dev` em producao;
- nao usar `db push` como estrategia de schema em runtime produtivo.

## Validacao de qualidade
```bash
cd SistemaLicencas

# gates core
npm run typecheck
npm run test
npm run openapi:generate
npm run openapi:validate
npm run docs:lint

# contratos licensing engine
npm run test:contract:fake
npm run test:contract:prisma

# compatibilidade legado (requer Docker daemon)
npm run test:legacy:local

# admin-web
npm run admin-web:build
npm run admin-web:test
npm run admin-web:e2e
```

## Quickstart auth browser + SDK Python
Fluxo completo (mock OIDC, browser login e smoke SDK):
- [Guia de auth v2 (OIDC + offline)](./api/auth/README.md#quickstart-local-mock-oidc)

Resumo rapido:
```bash
cd SistemaLicencas
npm run dev:auth

cd sdk/python
set PYTHONPATH=src
python examples/browser_login_smoke.py
```
