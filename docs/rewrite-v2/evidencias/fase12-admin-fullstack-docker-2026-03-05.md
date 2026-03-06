# Evidencia Fase 12 - Deploy completo em Docker (admin panel + backend publico)

Data: 2026-03-05

## Objetivo validado
Entregar stack completa em Docker para borda publica (`admin-gateway` + `api`) com segregacao correta entre API publica e API interna administrativa.

## Artefatos implementados
- `docker-compose.prod.yml`
- `.env.prod.example`
- `apps/admin-web/Dockerfile`
- `apps/admin-web/docker/default.conf.template`
- `apps/admin-web/docker/config.js.template`
- `apps/admin-web/docker/40-runtime-config.sh`
- `apps/admin-web/public/config.js`
- `apps/admin-web/src/app/runtime-config.ts`
- `apps/admin-web/src/app/runtime-config.test.ts`
- `apps/admin-web/e2e/admin-operations.spec.ts`
- `scripts/gateway/smoke-test.mjs`
- `.github/workflows/admin-web-ci.yml`
- `ops/monitoring/prometheus.yml`
- `ops/monitoring/alert.rules.yml`
- `ops/monitoring/alertmanager.yml`
- `docs/deployment/configuration.md`
- `docs/deployment/admin-fullstack-docker-windows.md`
- `docs/rewrite-v2/roadmap-v2.md`
- `docs/rewrite-v2/progresso-v2-e-proximos-passos.md`

## Validacoes executadas (local)
Na raiz do workspace (`SistemaLicencas`):

1. `npm run admin-web:build` -> OK
2. `npm run admin-web:test` -> OK (`7` suites, `12` testes)
3. `npm run admin-web:e2e` -> OK (`2` testes Playwright)
4. `npm run typecheck` -> OK
5. `npm run docs:lint` -> OK
6. `docker compose --env-file .env.prod.example -f docker-compose.prod.yml config` -> OK

## Validacao de borda (smoke real em Docker)
Stack subida para teste controlado com certificados/credenciais temporarios:

```powershell
docker compose --env-file .env.smoke -f docker-compose.prod.yml up -d --wait --wait-timeout 240 postgres redis api admin-gateway
```

Smoke executado:

```powershell
$env:GATEWAY_BASE_URL='https://localhost'
$env:GATEWAY_BASIC_AUTH_USER='admin'
$env:GATEWAY_BASIC_AUTH_PASSWORD='smoke-password'
$env:GATEWAY_INSECURE_TLS='true'
npm run gateway:smoke
```

Resultado:
- `gateway smoke test: OK`
- Validacoes confirmadas:
  - `/` sem Basic Auth retorna `401`
  - `/api/v2/health` responde sem Basic Auth
  - `/api/v2/internal/admin/*` bloqueado externamente (`403`)
  - `/admin-api/*` funcional com Basic Auth + chave interna injetada no proxy

## Ajustes corretivos durante a validacao
1. `admin-web` e2e inicialmente falhou por `webServer.command` em cwd incorreto ao rodar a partir do workspace.
   - Correcao: `apps/admin-web/playwright.config.ts` passou a usar o comando do dev server compativel com execucao via workspace.
2. Healthcheck da API falhou em runtime por uso de `wget` ausente na imagem Node.
   - Correcao: healthcheck da `api` alterado para `node -e fetch(...)`.
3. Healthcheck do gateway falhou por tentativa em `localhost` (resolucao/escuta).
   - Correcao: healthcheck do `admin-gateway` alterado para `https://127.0.0.1/nginx-health`.

## Conclusao
Fase 12 revisada implementada em codigo, CI e documentacao, com smoke de borda validado localmente em Docker. Restam apenas etapas operacionais de ambiente (Cloudflare Full strict, WAF/rate-limit, port-forward do roteador e teste externo por rede movel).

