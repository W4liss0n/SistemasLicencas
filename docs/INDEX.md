# Indice de Documentacao

## 1. Operacao diaria
1. [Configuracao](./deployment/configuration.md)
2. [Docker](./deployment/docker.md)
3. [Checklist OTel nao-dev](./deployment/opentelemetry-checklist.md)
4. [Rollout License Engine](./deployment/license-engine-rollout.md)
5. [Migrations](./database/migrations.md)
6. [Roadmap v2 (feito x faltante)](./rewrite-v2/roadmap-v2.md)
7. [Matriz de compatibilidade](./rewrite-v2/compatibility-matrix.generated.md)
8. [Mini-spec Interface Web Interna](./rewrite-v2/mini-spec-fase11-interface-web-interna.md)
9. [Mini-spec Hardening Interface Web Interna (fase 12)](./rewrite-v2/mini-spec-fase12-hardening-interface-web-interna.md)

## 2. API publica v2
- [Auth de usuario final (OIDC + offline)](./api/auth/README.md)
- [Licensing runtime](./api/license/README.md)
- [POST /validate](./api/license/validate.md)
- [POST /activate](./api/license/activate.md)
- [POST /heartbeat](./api/license/heartbeat.md)
- [POST /transfer](./api/license/transfer.md)
- [POST /deactivate](./api/license/deactivate.md)
- [Design de API v2](./api/rewrite-api-design.md)

## 2.1 API interna (operacao)
- [Admin backoffice interno](./api/internal/README.md)
- [Provisionamento interno de licencas](./api/internal/admin-license-provisioning.md)
- [Interface Web Interna (fase 11)](./rewrite-v2/mini-spec-fase11-interface-web-interna.md)
- [Hardening Interface Web Interna (fase 12)](./rewrite-v2/mini-spec-fase12-hardening-interface-web-interna.md)

## 3. Arquitetura
- [Visao geral](./architecture/overview.md)
- [Fluxo de dados](./architecture/data-flow.md)
- [Estado da validacao do rewrite](./architecture/rewrite-do-zero-validacao.md)

## 4. Banco de dados
- [Schema Prisma/PostgreSQL](./database/schema.md)
- [Historico de migrations](./database/migrations.md)
- [Arquitetura de dados v2](./database/rewrite-database-architecture.md)

## 5. Seguranca e observabilidade
- [Fingerprint de dispositivo](./security/fingerprint.md)
- [Rate limiting e idempotencia](./security/rate-limiting.md)
- [Modelo de login offline](./security/offline-login-model.md)
- [Arquitetura de erros](./ERROR_MESSAGES_ARCHITECTURE.md)

## 6. ADRs
- [Indice ADR](./adr/README.md)
