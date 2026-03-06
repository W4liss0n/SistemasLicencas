# Mini-spec Fase 11 - Interface Web Interna

Data: 2026-03-05

## Objetivo
Entregar uma interface web interna para operacao de licencas do `sistema-licencas-v2`, consumindo apenas APIs internas (`/api/v2/internal/admin/*`) e mantendo segredo de autenticacao interna fora do navegador.

## Escopo
- dashboard operacional com resumo agregado (`operational-summary`)
- busca por chave de licenca
- detalhe operacional da licenca
- provisionamento de licenca
- acoes administrativas: renovar, bloquear, desbloquear e cancelar

Fora de escopo:
- novos endpoints publicos
- portal cliente
- automacao billing/webhook
- migracao de banco

## Stack adotada
- React 19
- Vite 7
- TypeScript
- MUI 7
- TanStack Query v5
- React Hook Form + Zod
- Vitest + Testing Library + MSW
- Playwright

## Seguranca
- frontend chama apenas `/admin-api/*`
- proxy do Vite faz rewrite para `/api/v2/internal/admin/*`
- `X-Internal-Api-Key` injetado no proxy server-side
- `ADMIN_INTERNAL_API_KEY` nunca usa prefixo `VITE_`
- mutacoes exigem `Idempotency-Key`

## Fluxos
1. Dashboard:
   - consulta `GET /admin-api/operational-summary?window_days=<n>`
2. Busca de licenca:
   - entrada de `licenseKey` com navegacao para detalhe
3. Detalhe da licenca:
   - dados de licenca, assinatura, plano, cliente e dispositivos
   - trilho de decisao operacional por sessao
4. Provisionamento:
   - `POST /admin-api/licenses`
5. Acoes:
   - `POST /admin-api/licenses/:licenseKey/renew`
   - `POST /admin-api/licenses/:licenseKey/block`
   - `POST /admin-api/licenses/:licenseKey/unblock`
   - `POST /admin-api/licenses/:licenseKey/cancel`

## Feature flag
- `VITE_ADMIN_WEB_ENABLE_MUTATIONS` controla habilitacao de mutacoes

## Scripts raiz
- `npm run admin-web:dev`
- `npm run admin-web:build`
- `npm run admin-web:test`
- `npm run admin-web:e2e`

## Evidencias
- `docs/rewrite-v2/evidencias/fase11-interface-web-interna-2026-03-05.md`
