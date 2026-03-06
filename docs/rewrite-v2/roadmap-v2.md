# Roadmap v2 - Feito e Faltante

Data de atualizacao: 2026-03-05

## Objetivo
Consolidar um plano unico do runtime `sistema-licencas-v2`, separando:
- o que ja foi entregue e validado
- o que ainda falta para fechar operacao, evolucao funcional e governanca

## Escopo deste roadmap
- API publica v2 de licensing
- compatibilidade semantica com legado
- observabilidade e qualidade de entrega
- backlog de evolucao do dominio

## Estado atual (resumo executivo)
Status geral: **runtime v2 operacional para licensing**, com estabilizacao P0 de oracle concluida, fase P1 de dados/metricas/OTel concluida, fase de evolucao do licensing engine concluida, fase inicial da interface web interna concluida, fase de auth de usuario final com offline seguro concluida e fase 14A de login via browser OIDC concluida.

### Validacoes locais mais recentes (nesta workspace)
- `npm run typecheck` -> OK
- `npm run test` -> OK
- `npm run test:contract:fake` -> OK
- `npm run test:contract:prisma` -> OK
- `npm run openapi:generate` -> OK
- `npm run openapi:validate` -> OK
- `npm run docs:lint` -> OK
- `npm run test:legacy:local` -> falha cedo com preflight guiado quando Docker daemon esta indisponivel
- `npm run admin-web:build` -> OK
- `npm run admin-web:test` -> OK
- `npm run admin-web:e2e` -> OK

## O que ja foi feito

### 1) Contrato publico v2 implementado
Concluido:
- `POST /api/v2/license/authenticate`
- `POST /api/v2/licenses/validate`
- `POST /api/v2/licenses/activate`
- `POST /api/v2/licenses/heartbeat`
- `POST /api/v2/licenses/transfer`
- `POST /api/v2/licenses/deactivate`
- `GET /api/v2/health`
- `GET /api/v2/metrics` quando habilitado

### 2) Hardening de autenticacao
Concluido:
- remocao de credencial fixa
- persistencia de credenciais em `client_credentials`
- hash forte de senha com `scrypt` + comparacao segura + pepper
- adapters por ambiente (Prisma em dev/prod, in-memory em teste)

### 3) Regras transversais de seguranca e consistencia
Concluido:
- `X-Program-Id` obrigatorio em licensing
- `Idempotency-Key` obrigatorio em `activate`, `transfer`, `deactivate`
- normalizacao de erro em `application/problem+json`
- correlacao por `trace_id` e `x-request-id`
- `ValidationPipe` global e rate limit global

### 4) Observabilidade baseline
Concluido:
- inicializacao e shutdown de OpenTelemetry
- metricas Prometheus basicas:
  - `http_requests_total`
  - `http_request_duration_ms`
  - `license_runtime_failures_total`
  - `idempotency_replay_total`

### 5) Oracle de compatibilidade v1/v2
Concluido:
- automacao local (`scripts/oracle/*`)
- matriz de compatibilidade gerada automaticamente
- cenarios de sucesso e falha executados
- ultimo artefato gerado: 12 cenarios, 0 divergencia nao aceita

### 6) Reescrita e governanca de documentacao
Concluido:
- reescrita do conjunto principal de docs (`api`, `architecture`, `database`, `deployment`, `security`)
- lint de docs para evitar drift com referencias legadas fora do escopo permitido

### 7) Operacao de dados e cobertura de metricas (P1)
Concluido:
- script de limpeza por lotes para `idempotency_keys` expiradas (`npm run idempotency:cleanup`)
- modo seguro de simulacao (`npm run idempotency:cleanup:dry-run`)
- agendamento diario via GitHub Actions (`.github/workflows/idempotency-cleanup.yml`)
- suite e2e dedicada para `GET /api/v2/metrics` em cenarios enabled/disabled

### 8) Estabilizacao operacional do oracle (P0)
Concluido:
- preflight explicito de Docker no fluxo oracle antes de `docker compose`
- erro operacional guiado quando Docker daemon nao esta ativo
- `test:legacy:local` com teardown condicional (sem ruido adicional quando preflight falha)
- job dedicado `oracle-compat` no CI (`.github/workflows/ci.yml`)

### 9) Checklist operacional de OTel fora de dev (P1)
Concluido:
- checklist publicado para `staging` e `production`:
  - `docs/deployment/opentelemetry-checklist.md`
- regras de configuracao e precedencia OTLP documentadas em `docs/deployment/configuration.md`
- navegacao principal atualizada em `docs/README.md` e `docs/INDEX.md`

Evidencia:
- publicacao documental em 2026-03-04 com procedimento de validacao operacional e rollback.

### 10) Evolucao do licensing engine (P1)
Concluido:
- feature flag de estrategia introduzida:
  - `LICENSE_ENGINE_STRATEGY=auto|fake|prisma`
- politica de seguranca aplicada:
  - `LICENSE_ENGINE_STRATEGY=fake` bloqueado em `NODE_ENV=production`
- resolucao de engine desacoplada de `NODE_ENV` puro:
  - `auto` usa `fake` em `test` e `prisma` nos demais ambientes
- suite de contrato no nivel da porta iniciada:
  - `test/contract/license-engine.contract.shared.ts`
  - `test/contract/fake-license-engine.contract.spec.ts`
  - `test/contract/prisma-license-engine.contract.spec.ts`
- workflow opcional dedicado para contratos Prisma:
  - `.github/workflows/license-engine-contract.yml`
- runbook operacional de rollout por estrategia:
  - `docs/deployment/license-engine-rollout.md`

Evidencia local:
- execucao local concluida em 2026-03-04:
  - `typecheck`, `test`, `test:contract:fake`, `test:contract:prisma`, `docs:lint` -> OK
- registro detalhado:
  - `docs/rewrite-v2/evidencias/licensing-engine-p1-local-2026-03-04.md`
- estrategia e rollout documentados:
  - `docs/deployment/configuration.md`
  - `docs/deployment/license-engine-rollout.md`

### 11) Auth de usuario final com offline seguro + SDK Python (P5)
Concluido:
- novo modulo `end-user-auth` com endpoints publicos:
  - `GET /api/v2/auth/oidc/config`
  - `POST /api/v2/auth/login`
  - `POST /api/v2/auth/refresh`
  - `POST /api/v2/auth/logout`
  - `GET /api/v2/auth/me`
- `GET /.well-known/jwks.json` para validacao local do token offline RS256.
- endpoints internos para gestao de usuario final:
  - `POST /api/v2/internal/admin/users`
  - `PATCH /api/v2/internal/admin/users/:id`
  - `POST /api/v2/internal/admin/users/:id/block`
  - `POST /api/v2/internal/admin/users/:id/unblock`
- persistencia de auth dedicada:
  - `end_users`
  - `end_user_sessions`
  - `auth_audit_events`
- estrategia offline versionada:
  - `legacy_hmac` (licensing existente)
  - `rs256_offline_session` (login de usuario final)
- metricas de auth/offline adicionadas:
  - `auth_oidc_login_success_total`
  - `auth_oidc_login_failure_total`
  - `auth_oidc_code_exchange_failure_total`
  - `offline_login_attempt_total`
  - `offline_login_blocked_total`
  - `clock_tamper_detected_total`
  - `refresh_replay_detected_total`
- SDK Python em `sdk/python` com:
  - `AuthClient.login_with_browser/login_with_authorization_code/refresh/logout/whoami`
  - `OfflineSessionValidator.can_login_offline`
  - anti-rollback de relogio com `time.monotonic_ns()`
  - armazenamento seguro por keyring (com opcao de arquivo local para testes)

## O que falta (lacunas objetivas)

### A) Modulos de dominio ainda placeholder
Gap atual:
- nenhum modulo restante em placeholder no `AppModule`.

Progresso parcial da fase:
- `subscription`, `catalog-billing`, `device-trust`, `identity-access`, `audit-security`, `offline-entitlement` e `admin-backoffice` sairam de placeholder para modulo real com providers/ports internos.
- extraidas regras de dominio para consumo interno do `license-runtime`, sem novos endpoints publicos.

## Roadmap proposto (priorizado)

## Fase 6 - Estabilizacao operacional de gates (P0)
Objetivo: garantir que os gates criticos rodem de forma previsivel.

Entregas:
1. [Concluido] Preflight no fluxo oracle para validar Docker antes de subir stack.
2. [Concluido] Mensagem de erro operacional clara com acao recomendada.
3. [Concluido] Execucao automatizada do oracle em ambiente CI com Docker disponivel.

Criterio de saida:
- gate de compatibilidade executa de forma deterministica no CI.
- falha local por ambiente nao mascara falha funcional real.

## Fase 7 - Operacao de dados e observabilidade (P1)
Objetivo: reduzir risco operacional continuo.

Entregas:
1. [Concluido] Job de limpeza de `idempotency_keys` expiradas.
2. [Concluido] Testes de integracao para `GET /api/v2/metrics` (enabled/disabled).
3. [Concluido] Checklist operacional para OTel (`OTEL_EXPORTER_OTLP_ENDPOINT`) em ambientes nao-dev.

Criterio de saida:
- politica de retencao de idempotencia ativa e validada.
- cobertura de metricas impede regressao de exposicao de endpoint.
- checklist de OTel publicado e validado (evidencia: `docs/deployment/opentelemetry-checklist.md`).

## Fase 8 - Evolucao funcional do licensing engine (P1)
Objetivo: preparar runtime para regra de negocio completa.

Entregas:
1. [Concluido] Provider real por tras de `LicenseEnginePort` com estrategia configuravel.
2. [Concluido] Testes de contrato para garantir paridade semantica entre adapter fake e adapter real.
3. [Concluido] Plano de rollout gradual por flag/config.

Criterio de saida:
- provider real habilitavel sem quebra de contrato HTTP.
- regressao coberta por testes de contrato e e2e.
- rollout nao-test documentado com estrategia e rollback.

## Fase 9 - Expansao dos modulos de dominio (P2)
Objetivo: sair de placeholders para capacidades de produto.

Status: **concluido** (consolidado em 2026-03-04)

Entregas:
1. [Concluido] Definicao de escopo minimo para `subscription` e `catalog-billing`.
2. [Concluido] Mini-specs iniciais:
   - `docs/rewrite-v2/mini-spec-subscription-mvp-interno.md`
   - `docs/rewrite-v2/mini-spec-catalog-billing-mvp-interno.md`
   - `docs/rewrite-v2/mini-spec-device-trust-mvp-interno.md`
   - `docs/rewrite-v2/mini-spec-identity-access-mvp-interno.md`
   - `docs/rewrite-v2/mini-spec-audit-security-mvp-interno.md`
   - `docs/rewrite-v2/mini-spec-offline-entitlement-mvp-interno.md`
   - `docs/rewrite-v2/mini-spec-admin-backoffice-mvp-interno.md`
3. [Concluido] Sequenciamento iniciado por dependencia de negocio (`subscription` e `catalog-billing` primeiro).
4. [Concluido] Expandir modulos restantes (`identity-access`, `offline-entitlement`, `audit-security`, `admin-backoffice`).

Criterio de saida:
- cada modulo sai de placeholder com pelo menos: controller/service, testes e doc de contrato.

## Fase 10 - Provisionamento interno de licencas (P3)
Objetivo: habilitar criacao e gestao manual de licencas via backoffice interno, sem expor novos endpoints publicos para clientes finais.

Status: **concluido** (entrega inicial em 2026-03-04)

Entregas:
1. [Concluido] API interna protegida no modulo `admin-backoffice` para:
2. [Concluido] criar/provisionar licenca;
3. [Concluido] renovar validade;
4. [Concluido] bloquear/desbloquear;
5. [Concluido] cancelar licenca.
6. [Concluido] Idempotencia nas mutacoes internas para evitar duplicidade operacional.
7. [Concluido] Auditoria das acoes administrativas em `audit_logs`.
8. [Concluido] Documentacao interna e mini-spec da fase.

Criterio de saida:
- operacoes internas funcionais para provisionamento e gestao manual;
- nenhum endpoint publico de licensing alterado;
- sem regressao de contrato HTTP publico v2;
- gates de qualidade e contratos existentes verdes.

## Fase 11 - Interface web interna do backoffice (P3)
Objetivo: habilitar operacao interna de licencas via UI web dedicada ao v2, sem expor novos endpoints publicos e sem expor `X-Internal-Api-Key` no navegador.

Status: **concluido** (entrega inicial em 2026-03-05)

Entregas:
1. [Concluido] App `admin-web` criado em `apps/admin-web` com stack React + Vite + TypeScript.
2. [Concluido] Roteamento e telas operacionais:
   - dashboard (`operational-summary`)
   - busca por chave de licenca
   - provisionamento
   - detalhe da licenca com trilho de decisao operacional
   - acoes administrativas (`renew`, `block`, `unblock`, `cancel`)
3. [Concluido] Integracao por proxy seguro `/admin-api/*` -> `/api/v2/internal/admin/*` com injecao server-side de `X-Internal-Api-Key`.
4. [Concluido] Idempotencia nas mutacoes do frontend com `Idempotency-Key` por operacao.
5. [Concluido] Feature flag de mutacao no frontend (`VITE_ADMIN_WEB_ENABLE_MUTATIONS`).
6. [Concluido] Suite de testes do admin-web:
   - unit/integration com Vitest + MSW
   - e2e com Playwright (fluxo login + dashboard)
7. [Concluido] Scripts raiz adicionados:
   - `admin-web:dev`
   - `admin-web:build`
   - `admin-web:test`
   - `admin-web:e2e`
8. [Concluido] Runbook e docs da fase publicados.

Criterio de saida:
- operacao interna principal de licencas disponivel via UI no v2;
- nenhum endpoint publico novo;
- sem alteracao de schema de dados;
- segredo interno mantido fora do browser;
- build/test/e2e do admin-web verdes.

Pendencias remanescentes da trilha web (enderecadas na Fase 12):
- autenticacao corporativa no edge para exposicao fora de ambiente local;
- cobertura e2e completa dos fluxos criticos de mutacao;
- consolidacao de observabilidade/alertas para rotas internas administrativas;
- pipeline CI dedicado ao `admin-web` com gates obrigatorios;
- ajuste de performance de bundle para operacao em rede corporativa restrita.

## Fase 12 - Deploy completo em Docker (admin panel + backend publico) (P4)
Objetivo: publicar stack completa no host Windows com Docker (gateway NGINX + admin-web + API publica), mantendo API administrativa interna protegida e trilha de rollout/rollback operacional.

Status: **concluida (entrega de codigo e automacao em 2026-03-05)**

Entregas:
1. [Concluido] Gateway unico NGINX para borda:
   - `GET /` e assets com `auth_basic`
   - `/admin-api/*` -> rewrite para `/api/v2/internal/admin/*` com injecao de `X-Internal-Api-Key`
   - `/api/v2/*` publico sem `auth_basic`
   - bloqueio externo de `/api/v2/internal/admin/*` e `/api/v2/metrics`
   - TLS de origem configuravel por certificado Cloudflare origin (`origin.crt`/`origin.key`)
2. [Concluido] Container de producao do `admin-web`:
   - Dockerfile multi-stage
   - runtime `config.js` para `ADMIN_WEB_ENABLE_MUTATIONS` sem rebuild
   - frontend com fallback runtime -> `VITE_ADMIN_WEB_ENABLE_MUTATIONS`
3. [Concluido] Orquestracao de stack completa em `docker-compose.prod.yml`:
   - `postgres`, `redis`, `api`, `admin-gateway`, `prometheus`, `alertmanager`, `ddns`
   - rede Docker interna explicita (`v2_internal`)
   - exposicao externa apenas da porta `443`
   - `api` com `prisma:migrate:deploy` no startup
4. [Concluido] Seguranca operacional baseline:
   - `.env.prod.example` com variaveis de prod (`INTERNAL_ADMIN_API_KEYS`, `ADMIN_INTERNAL_API_KEY`, `CF_API_TOKEN`, `CF_ZONE_ID`, `CF_RECORD_NAME`)
   - guia de `.htpasswd` e checklist de secrets no runbook
5. [Concluido] CI dedicado `admin-web-ci`:
   - `admin-web:build`
   - `admin-web:test`
   - `admin-web:e2e`
   - job adicional de smoke de gateway via Docker Compose
6. [Concluido] Cobertura de testes da borda e fluxos criticos:
   - Playwright expandido para provision/renew/block/unblock/cancel + verificacao de `Idempotency-Key`
   - `scripts/gateway/smoke-test.mjs` para validar regras de acesso/proxy
7. [Concluido] Observabilidade e alertas:
   - scrape interno de `/api/v2/metrics` por Prometheus
   - regras para 5xx, p95 e pico de `block/cancel`
8. [Concluido] Documentacao e runbook:
   - `docs/deployment/configuration.md`
   - `docs/deployment/admin-fullstack-docker-windows.md`
   - roadmap/progresso/evidencia da fase atualizados

Criterio de saida:
- API publica v2 acessivel por borda (`/api/v2/*`);
- painel admin protegido por Basic Auth;
- API interna administrativa inacessivel diretamente da internet;
- gates de frontend + smoke de gateway ativos no CI;
- rollback de mutacoes via runtime config documentado.

Pendencias operacionais fora de codigo (ambiente):
- aplicar `Full (strict)` e WAF/rate-limit na Cloudflare;
- configurar port forwarding `443/TCP` no roteador;
- validar acesso externo por rede movel apos ciclo DDNS.

## Fase 13 - Login de usuario final com offline seguro + SDK Python (P5)
Objetivo: habilitar autenticacao de usuario final por programa com continuidade offline segura e revalidacao online obrigatoria.

Status: **concluida (entrega de codigo, testes e docs em 2026-03-05)**

Entregas:
1. [Concluido] Tokens online (`access` + `refresh`) com segredos dedicados.
2. [Concluido] Token offline RS256 com `kid` e publicacao de JWKS.
3. [Concluido] Vinculo de sessao por fingerprint e revogacao por bloqueio/reset.
4. [Concluido] Semantica de erro canonica:
   - `offline_not_allowed`
   - `clock_tamper_detected`
   - `entitlement_denied`
   - `session_revoked`
5. [Concluido] SDK Python com validacao offline e anti-rollback de relogio.
6. [Concluido] CI dedicado do SDK Python com lint, unit e integracao contra API local.
7. [Concluido] Documentacao de auth, fingerprint e modelo offline atualizada.

Criterio de saida:
- login/refresh/logout/me de usuario final operacionais sem quebrar `/api/v2/licenses/*`;
- validacao offline limitada por tempo + assinatura + fingerprint;
- bloqueio administrativo invalida refresh/sessao subsequente;
- backend e SDK com suites de teste verdes.

## Fase 14A - Login via Browser (OIDC + PKCE) sem legado de senha (P5)
Objetivo: migrar login de usuario final para browser system login com Authorization Code + PKCE, mantendo sessao interna (`access`/`refresh`) e offline token RS256.

Status: **concluida (entrega de codigo, testes e docs em 2026-03-05)**

Entregas:
1. [Concluido] Novo endpoint de descoberta para launcher: `GET /api/v2/auth/oidc/config`.
2. [Concluido] `POST /api/v2/auth/login` migrado para payload OIDC:
   - `authorization_code`
   - `code_verifier`
   - `redirect_uri` loopback
   - `nonce`
   - `device_fingerprint`
3. [Concluido] Validacao OIDC provider-agnostic no backend:
   - discovery (`/.well-known/openid-configuration`)
   - code exchange no `token_endpoint`
   - validacao `id_token` (`iss`, `aud`, assinatura, `exp`, `nonce`, `sub`, `email_verified`)
4. [Concluido] Bind de identidade externa em `EndUser`:
   - `oidc_issuer`
   - `oidc_subject`
   - `email_verified_at`
   - unique `(oidc_issuer, oidc_subject)`
5. [Concluido] Login bloqueia mismatch de subject para mesmo email com `invalid_credentials`.
6. [Concluido] Admin user sem dependencias de senha no fluxo atual:
   - criacao sem senha
   - endpoint de reset removido da API interna
7. [Concluido] SDK Python com browser login:
   - PKCE `S256`
   - callback loopback `127.0.0.1`
   - persistencia de sessao inalterada para refresh/offline
8. [Concluido] Observabilidade OIDC adicionada:
   - `auth_oidc_login_success_total`
   - `auth_oidc_login_failure_total`
   - `auth_oidc_code_exchange_failure_total`

Criterio de saida:
- login do usuario final ocorre exclusivamente via browser OIDC;
- refresh/logout/me permanecem compatíveis;
- offline segue funcional com RS256 + anti-tamper;
- suites backend e SDK verdes.

## Checklist de acompanhamento

Atualizar semanalmente:
1. Status por fase (`nao iniciado`, `em andamento`, `bloqueado`, `concluido`).
2. Risco/bloqueio atual e dono responsavel.
3. Evidencia de execucao dos gates (`typecheck`, `test`, `openapi`, `docs:lint`, `test:legacy:local`).

## Dependencias externas e riscos
- Docker local/CI para oracle de compatibilidade.
- Coletor OTel disponivel quando `OTEL_ENABLED=true`.
- Definicao corporativa de autenticacao no edge para exposicao da interface `admin-web` fora de ambiente local.

## Referencias relacionadas
- `docs/rewrite-v2/progresso-v2-e-proximos-passos.md`
- `docs/rewrite-v2/evidencias/licensing-engine-p1-local-2026-03-04.md`
- `docs/rewrite-v2/evidencias/fase9-p2-subscription-catalog-interno-2026-03-04.md`
- `docs/rewrite-v2/evidencias/fase9-p2-device-trust-interno-2026-03-04.md`
- `docs/rewrite-v2/evidencias/fase9-p2-identity-access-interno-2026-03-04.md`
- `docs/rewrite-v2/evidencias/fase9-p2-audit-security-interno-2026-03-04.md`
- `docs/rewrite-v2/evidencias/fase9-p2-offline-entitlement-interno-2026-03-04.md`
- `docs/rewrite-v2/evidencias/fase9-p2-admin-backoffice-interno-2026-03-04.md`
- `docs/rewrite-v2/evidencias/fase9-p2-consolidacao-interno-2026-03-04.md`
- `docs/rewrite-v2/mini-spec-fase10-provisionamento-interno.md`
- `docs/rewrite-v2/evidencias/fase10-provisionamento-interno-2026-03-04.md`
- `docs/rewrite-v2/mini-spec-fase11-interface-web-interna.md`
- `docs/rewrite-v2/evidencias/fase11-interface-web-interna-2026-03-05.md`
- `docs/rewrite-v2/mini-spec-fase12-hardening-interface-web-interna.md`
- `docs/deployment/admin-fullstack-docker-windows.md`
- `docs/rewrite-v2/evidencias/fase12-admin-fullstack-docker-2026-03-05.md`
- `docs/rewrite-v2/evidencias/fase13-auth-offline-2026-03-05.md`
- `docs/rewrite-v2/evidencias/fase14a-browser-login-oidc-2026-03-05.md`
- `docs/rewrite-v2/compatibility-matrix.md`
- `docs/rewrite-v2/compatibility-matrix.generated.md`
- `docs/architecture/overview.md`
- `docs/README.md`
- `docs/deployment/license-engine-rollout.md`
- `docs/deployment/opentelemetry-checklist.md`
- `docs/security/offline-login-model.md`
