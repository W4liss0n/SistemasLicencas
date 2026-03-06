# Progresso v2 e Proximos Passos

Data de referencia: 2026-03-05

## Objetivo deste ciclo
Fechar o hardening do runtime publico v2 com:
- oracle local de compatibilidade v1/v2
- autenticacao sem credencial fixa
- baseline de observabilidade
- reescrita completa da documentacao `docs/`

## Status por fase do plano

### Fase 1 - Oracle local de compatibilidade
Status: concluido

Entregas:
- automacao local em `scripts/oracle/*`
- compose isolado para legado e v2 em `scripts/oracle/docker-compose.oracle.yml`
- runner de compatibilidade expandido em `test/legacy/compatibility.runner.ts`
- matriz gerada automaticamente em `docs/rewrite-v2/compatibility-matrix.generated.md`

Cenarios cobertos:
- authenticate_invalid_credentials
- authenticate_success
- validate_bad_payload
- validate_unknown_license
- validate_success
- activate_success
- heartbeat_success
- transfer_success
- transfer_idempotency_replay
- transfer_limit_exceeded
- deactivate_success

### Fase 2 - Hardening de authenticate
Status: concluido

Entregas:
- modelo Prisma `ClientCredential`
- migration `0002_client_credentials`
- validacao de senha com `scrypt` + `timingSafeEqual` + pepper
- adapters de credencial:
  - `PrismaClientCredentialAdapter` (dev/prod)
  - `InMemoryClientCredentialAdapter` (test)
- seed canonica com credencial persistida para `demo-program`

### Fase 3 - Baseline de observabilidade
Status: concluido

Entregas:
- inicializacao OTel antes do bootstrap da app
- encerramento OTel no shutdown
- metricas Prometheus:
  - `http_requests_total`
  - `http_request_duration_ms`
  - `license_runtime_failures_total`
  - `idempotency_replay_total`
- endpoint de metricas em `GET /api/v2/metrics` quando `METRICS_ENABLED=true`

### Fase 4 - Reescrita completa de docs
Status: concluido

Reescritos:
- `docs/README.md`
- `docs/INDEX.md`
- `docs/ERROR_MESSAGES_ARCHITECTURE.md`
- `docs/api/*`
- `docs/architecture/*`
- `docs/database/*`
- `docs/deployment/*`
- `docs/security/*`

Governanca:
- `npm run docs:lint` bloqueia referencias legadas fora das paginas de compatibilidade.

### Fase 5 - Gates de qualidade
Status: concluido

Comandos executados com sucesso (rodada 2026-03-04):
- `npm run typecheck` -> OK
- `npm run test` -> OK
- `npm run openapi:generate` -> OK
- `npm run openapi:validate` -> OK
- `npm run test:legacy:local` -> OK
- `npm run docs:lint` -> OK

Observacao operacional:
- No fluxo oracle local pode ocorrer falha transiente de conexao no migrate do legado na primeira tentativa; a automacao ja faz retry e conclui a execucao.

### Fase 6 - Operacao de dados e metricas (P1)
Status: concluido

Entregas:
- script de limpeza de `idempotency_keys` expiradas por lotes:
  - `npm run idempotency:cleanup`
  - `npm run idempotency:cleanup:dry-run`
- workflow agendado diario:
  - `.github/workflows/idempotency-cleanup.yml`
  - segredo requerido: `IDEMPOTENCY_CLEANUP_DATABASE_URL`
- suite e2e dedicada para metricas:
  - `test/e2e/metrics.e2e.spec.ts`
  - cobertura de `GET /api/v2/metrics` com `METRICS_ENABLED=false/true`

### Fase 7 - Estabilizacao operacional de gates (P0)
Status: concluido

Entregas:
- preflight de Docker adicionado no oracle local antes de `docker compose`
- erro operacional guiado quando Docker daemon nao esta ativo
- `test:legacy:local` com teardown condicional para evitar ruido quando preflight falha
- job dedicado `oracle-compat` adicionado no CI (`.github/workflows/ci.yml`)

### Fase 8 - Checklist operacional OTel nao-dev (P1)
Status: concluido

Entregas:
- checklist operacional publicado para `staging` e `production`:
  - `docs/deployment/opentelemetry-checklist.md`
- alinhamento de configuracao OTLP no guia de deploy:
  - `docs/deployment/configuration.md`
- atualizacao da navegacao principal:
  - `docs/README.md`
  - `docs/INDEX.md`

Evidencia:
- publicacao do checklist em 2026-03-04 com:
  - pre-deploy e pos-deploy
  - troubleshooting rapido
  - rollback operacional
  - template de registro de evidencia (`timestamp`, ambiente, `service.name`, amostra de trace)

### Fase 9 - Evolucao funcional do licensing engine (P1)
Status: concluido

Entregas parciais:
- feature flag de estrategia introduzida no runtime/config:
  - `LICENSE_ENGINE_STRATEGY=auto|fake|prisma`
- regra de seguranca aplicada:
  - bloqueio de `fake` em `NODE_ENV=production`
- selecao de provider refatorada por estrategia:
  - `auto` => `fake` em `test`, `prisma` em `development/production`
- suite de contrato iniciada no nivel de `LicenseEnginePort`:
  - `test/contract/license-engine.contract.shared.ts`
  - `test/contract/fake-license-engine.contract.spec.ts`
  - `test/contract/prisma-license-engine.contract.spec.ts`
- job opcional dedicado para contratos Prisma (manual + agendado):
  - `.github/workflows/license-engine-contract.yml`
- runbook de rollout da estrategia em nao-test:
  - `docs/deployment/license-engine-rollout.md`

Evidencia parcial:
- scripts adicionados:
  - `npm run test:contract:fake`
  - `npm run test:contract:prisma`
- execucao local registrada em 2026-03-04:
  - `npm run typecheck` -> OK
  - `npm run test` -> OK (`8` suites, `45` testes)
  - `npm run test:contract:fake` -> OK (`1` suite, `8` testes)
  - `npm run test:contract:prisma` -> OK (`1` suite, `9` testes)
  - `npm run docs:lint` -> OK
- evidencia detalhada:
  - `docs/rewrite-v2/evidencias/licensing-engine-p1-local-2026-03-04.md`
- navegacao/documentacao de deploy atualizada:
  - `docs/deployment/configuration.md`
  - `docs/README.md`
  - `docs/INDEX.md`

### Fase 9 (P2) - Expansao dos modulos de dominio
Status: concluido

Escopo atual:
- completar expansao dos modulos de dominio restantes sem alterar contrato HTTP publico
- manter paridade funcional estrita do contrato HTTP v2
- nao introduzir novos endpoints ou migracoes de schema nesta etapa

Entregas concluidas no inicio da fase:
- `subscription` deixou de ser placeholder:
  - modulo com provider exportado (`SUBSCRIPTION_READ_PORT`)
  - implementacao Prisma `PrismaSubscriptionReadService`
  - testes unitarios dedicados
- `catalog-billing` deixou de ser placeholder:
  - modulo com provider exportado (`CATALOG_BILLING_POLICY_PORT`)
  - implementacao Prisma `PrismaCatalogBillingPolicyService`
  - testes unitarios dedicados
- `device-trust` deixou de ser placeholder:
  - modulo com provider exportado (`DEVICE_TRUST_PORT`)
  - implementacao Prisma `PrismaDeviceTrustService`
  - testes unitarios dedicados
- `identity-access` deixou de ser placeholder:
  - modulo com provider exportado (`IDENTITY_ACCESS_PORT`)
  - implementacoes Prisma/InMemory com selecao por ambiente
  - `AuthenticationService` refatorado para fachada de dominio
- `audit-security` deixou de ser placeholder:
  - modulo com provider exportado (`AUDIT_SECURITY_PORT`)
  - implementacao Prisma resiliente para historico/eventos/logs/contagem
- `offline-entitlement` deixou de ser placeholder:
  - modulo com provider exportado (`OFFLINE_ENTITLEMENT_PORT`)
  - implementacao HMAC para emissao de token offline
- `admin-backoffice` deixou de ser placeholder:
  - modulo com provider exportado (`ADMIN_BACKOFFICE_PORT`)
  - implementacao interna de resumo operacional (sem endpoint novo)
- refator de `PrismaLicenseEngineAdapter` para delegar:
  - contexto elegivel de licenca/assinatura para `subscription`
  - autorizacao de programa e politica de plano para `catalog-billing`
  - fingerprint e ciclo de vida de `license_devices` para `device-trust`
  - contagem/log de auditoria para `audit-security`
  - emissao offline para `offline-entitlement`
- mini-specs publicadas:
  - `docs/rewrite-v2/mini-spec-subscription-mvp-interno.md`
  - `docs/rewrite-v2/mini-spec-catalog-billing-mvp-interno.md`
  - `docs/rewrite-v2/mini-spec-device-trust-mvp-interno.md`
  - `docs/rewrite-v2/mini-spec-identity-access-mvp-interno.md`
  - `docs/rewrite-v2/mini-spec-audit-security-mvp-interno.md`
  - `docs/rewrite-v2/mini-spec-offline-entitlement-mvp-interno.md`
  - `docs/rewrite-v2/mini-spec-admin-backoffice-mvp-interno.md`

Evidencia desta rodada:
- `docs/rewrite-v2/evidencias/fase9-p2-subscription-catalog-interno-2026-03-04.md`
- `docs/rewrite-v2/evidencias/fase9-p2-device-trust-interno-2026-03-04.md`
- `docs/rewrite-v2/evidencias/fase9-p2-identity-access-interno-2026-03-04.md`
- `docs/rewrite-v2/evidencias/fase9-p2-audit-security-interno-2026-03-04.md`
- `docs/rewrite-v2/evidencias/fase9-p2-offline-entitlement-interno-2026-03-04.md`
- `docs/rewrite-v2/evidencias/fase9-p2-admin-backoffice-interno-2026-03-04.md`
- `docs/rewrite-v2/evidencias/fase9-p2-consolidacao-interno-2026-03-04.md`

### Fase 10 (P3) - Provisionamento interno de licencas
Status: concluido (entrega inicial)

Entregas:
- API interna protegida em `admin-backoffice` para provisionar/renovar/bloquear/desbloquear/cancelar licencas.
- endpoint interno de detalhes operacionais de licenca.
- endpoint interno para expor resumo operacional (`operational-summary`).
- guard interno por header `X-Internal-Api-Key`.
- idempotencia em mutacoes internas com `Idempotency-Key`.
- auditoria de mutacoes administrativas em `audit_logs`.
- controller interno excluido do OpenAPI publico (`@ApiExcludeController`).
- mini-spec publicada:
  - `docs/rewrite-v2/mini-spec-fase10-provisionamento-interno.md`

Evidencia desta rodada:
- `docs/rewrite-v2/evidencias/fase10-provisionamento-interno-2026-03-04.md`

### Fase 11 (P3) - Interface web interna do backoffice
Status: concluido (entrega inicial)

Entregas:
- app dedicado `admin-web` criado em `apps/admin-web`.
- stack de frontend adotada:
  - React 19
  - Vite 7
  - TypeScript
  - MUI 7
  - TanStack Query v5
  - React Hook Form + Zod
- proxy seguro `/admin-api/*` no Vite:
  - rewrite para `/api/v2/internal/admin/*`
  - injecao server-side de `X-Internal-Api-Key`
  - segredo nao exposto ao browser
- fluxos implementados:
  - dashboard operacional (`operational-summary`)
  - busca por licenca
  - provisionamento
  - detalhe da licenca
  - acoes administrativas (`renew`, `block`, `unblock`, `cancel`)
- trilho de decisao operacional local por licenca na UI.
- mutacoes protegidas por feature flag:
  - `VITE_ADMIN_WEB_ENABLE_MUTATIONS`
- scripts raiz adicionados:
  - `npm run admin-web:dev`
  - `npm run admin-web:build`
  - `npm run admin-web:test`
  - `npm run admin-web:e2e`

Validacoes locais:
- `npm run admin-web:build` -> OK
- `npm run admin-web:test` -> OK (`6` suites, `10` testes)
- `npm run admin-web:e2e` -> OK (`1` teste)

Evidencia desta rodada:
- `docs/rewrite-v2/evidencias/fase11-interface-web-interna-2026-03-05.md`

Pendencias abertas apos entrega inicial:
- autenticacao corporativa no edge para acesso fora de ambiente local;
- pipeline CI dedicado ao `admin-web` com gates obrigatorios;
- cobertura e2e completa das mutacoes operacionais;
- observabilidade/alertas dedicados para rotas internas administrativas;
- reducao do tamanho do bundle inicial do frontend.

### Fase 12 (P4) - Deploy completo em Docker (admin panel + backend publico)
Status: concluido (entrega de codigo e automacao)

Entregas:
- stack de producao em `docker-compose.prod.yml` com `postgres`, `redis`, `api`, `admin-gateway`, `prometheus`, `alertmanager`, `ddns`.
- rede Docker interna explicita (`v2_internal`) e exposicao externa apenas em `443`.
- gateway NGINX de borda:
  - Basic Auth em `/` e `/admin-api/*`;
  - injecao de `X-Internal-Api-Key` para chamadas administrativas proxied;
  - bloqueio externo de `/api/v2/internal/admin/*` e `/api/v2/metrics`;
  - proxy publico para `/api/v2/*`.
- runtime config do frontend para `ADMIN_WEB_ENABLE_MUTATIONS` via `/config.js` (rollback sem rebuild).
- pipeline `admin-web-ci` com:
  - `admin-web:build`
  - `admin-web:test`
  - `admin-web:e2e`
  - smoke test de gateway em Docker Compose.
- e2e Playwright expandido para fluxo administrativo critico com validacao de `Idempotency-Key` em mutacoes.
- observabilidade/alertas operacionais da borda publicados em:
  - `ops/monitoring/prometheus.yml`
  - `ops/monitoring/alert.rules.yml`
  - `ops/monitoring/alertmanager.yml`
- runbook de deploy/rollback publicado:
  - `docs/deployment/admin-fullstack-docker-windows.md`

Evidencia desta rodada:
- `docs/rewrite-v2/evidencias/fase12-admin-fullstack-docker-2026-03-05.md`

Pendencias de ambiente (nao-bloqueantes de codigo):
- aplicar Cloudflare `Full (strict)` + WAF/rate-limit nas rotas publicas de licensing;
- configurar/revalidar port-forward `443/TCP` e teste externo por rede movel;
- marcar `ci` e `admin-web-ci` como required checks no branch principal.

## Riscos residuais
- collector OTLP continua dependencia externa quando `OTEL_ENABLED=true`.
- A compatibilidade e semantica (nao byte-a-byte); divergencias aceitas seguem documentadas na matriz.

## Proximos passos sugeridos
1. Executar rollout externo controlado (Cloudflare + DDNS + port-forward) e registrar evidencia de acesso por rede movel.
2. Publicar dashboard de operacao com p95 e taxa de erro por rota em ambiente produtivo.
3. Evoluir renovacao manual para fluxo automatizado por billing/webhook em fase posterior.
4. Quando o repositorio for publicado no Git, executar `license-engine-contract` e anexar evidencia de CI.
