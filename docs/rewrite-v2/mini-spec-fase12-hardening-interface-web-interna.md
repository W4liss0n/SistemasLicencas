# Mini-spec Fase 12 (Revisada) - Deploy completo em Docker (Admin + Backend Publico)

Data: 2026-03-05

## Objetivo
Publicar a stack completa no host Windows com Docker, Cloudflare e DDNS:
- `admin-web` acessivel externamente com Basic Auth no edge;
- API publica v2 disponivel para autenticacao/licenciamento dos apps;
- API interna administrativa protegida e bloqueada para acesso direto externo.

## Contexto
A Fase 11 entregou o app interno funcional. A revisao da Fase 12 amplia escopo para deploy full-stack de borda (gateway + backend publico), mantendo segregacao entre trilha publica e administrativa.

## Escopo
- gateway unico NGINX:
  - `/` e assets do painel com Basic Auth;
  - `/admin-api/*` com injecao de `X-Internal-Api-Key`;
  - `/api/v2/*` publico sem Basic Auth;
  - bloqueio de `/api/v2/internal/admin/*` e `/api/v2/metrics` na borda;
- runtime config de mutacoes no `admin-web` (`ADMIN_WEB_ENABLE_MUTATIONS`);
- stack de producao em `docker-compose.prod.yml`:
  - `postgres`, `redis`, `api`, `admin-gateway`, `prometheus`, `alertmanager`, `ddns`;
- CI dedicado do `admin-web` com `build`, `test`, `e2e` e smoke de gateway;
- observabilidade e alertas de licensing/admin;
- runbook de rollout/rollback para operacao em Windows + Docker.

Fora de escopo:
- SSO corporativo (fase posterior; Basic Auth adotado nesta fase);
- novos endpoints publicos alem do contrato v2 existente;
- mudancas de schema Prisma nao necessarias para o deploy de borda;
- migracao do host para Linux (fase posterior).

## Entregas previstas
1. Gateway de borda com roteamento/seguranca de paths.
2. Container de producao do `admin-web` com runtime config.
3. Compose produtivo sem exposicao direta de `api`, `postgres`, `redis`.
4. CI dedicado do frontend + smoke de gateway.
5. E2E expandido de fluxo administrativo critico com `Idempotency-Key`.
6. Prometheus + Alertmanager com regras para 5xx/p95/spike admin.
7. Runbook de deploy/rollback completo para Windows.

## Criterios de saida
- painel admin protegido por Basic Auth no edge;
- API publica v2 acessivel para apps clientes;
- API interna admin bloqueada para acesso direto externo;
- CI `admin-web` com gates verdes (build/test/e2e/smoke);
- evidencia publicada em `docs/rewrite-v2/evidencias/`.

## Artefatos associados
- `docs/rewrite-v2/roadmap-v2.md`
- `docs/rewrite-v2/progresso-v2-e-proximos-passos.md`
- `docs/deployment/configuration.md`
- `docs/deployment/admin-fullstack-docker-windows.md`
- `docs/rewrite-v2/evidencias/fase12-admin-fullstack-docker-2026-03-05.md`
