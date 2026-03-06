# Evidencia - Fase 13 Auth Offline Seguro + SDK Python

Data: 2026-03-05

## Escopo entregue
- modulo backend `end-user-auth` com endpoints publicos e internos para usuario final;
- persistencia Prisma de usuario/sessao/auditoria de auth;
- token offline RS256 + JWKS publico (`/.well-known/jwks.json`);
- revogacao de sessao em bloqueio/reset de senha;
- estrategia offline versionada (`legacy_hmac` e `rs256_offline_session`);
- SDK Python com login/refresh/logout/whoami e validacao offline local;
- deteccao de tamper de relogio no SDK por monotonic + wall clock;
- CI dedicado `sdk-python-ci.yml` com lint + unit + integration.

## Arquivos principais alterados
- `apps/api/src/modules/end-user-auth/*`
- `apps/api/src/modules/offline-entitlement/*`
- `apps/api/src/config/*`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/0003_end_user_auth/migration.sql`
- `apps/api/prisma/seed.ts`
- `sdk/python/*`
- `.github/workflows/sdk-python-ci.yml`

## Validacoes executadas localmente

### Backend
- comando: `npm run test -- --runInBand`
- resultado: **OK**
- resumo: `20 passed, 20 total` e `94 passed, 94 total`.

### SDK Python (unit)
- comando: `python -m pytest`
- resultado: **OK**
- resumo: `5 passed, 2 skipped` (testes de integracao pulados sem API local ligada).

### Typecheck
- comando: `npm run typecheck`
- resultado: **OK**

### OpenAPI
- comandos:
  - `npm run openapi:generate`
  - `npm run openapi:validate`
- resultado: **OK**

### Docs lint
- comando: `npm run docs:lint`
- resultado: **OK**

## Criterios de aceite cobertos
1. login online com emissao de access/refresh/offline e entitlement por programa.
2. bloqueio de usuario final negando login/refresh subsequente.
3. negacao por falta de entitlement para programa.
4. refresh com rotacao de token e revogacao em replay.
5. login offline validado localmente por assinatura + exp/nbf + fingerprint.
6. bloqueio de offline ao detectar volta de relogio (`clock_tamper_detected`).
7. contratos legados de licensing mantidos (suite de API existente verde).

## Observacoes de rollout
- endpoints de usuario final controlados por `END_USER_AUTH_ENABLED`.
- rollback imediato por flag sem impacto nos endpoints `/api/v2/licenses/*`.
