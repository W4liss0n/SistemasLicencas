# Evidencia - Fase 11 Interface Web Interna

Data: 2026-03-05

## Entregas
- app `admin-web` criado em `apps/admin-web`
- proxy seguro `/admin-api/*` com injecao de `X-Internal-Api-Key`
- telas:
  - login interno de operador (identidade local de sessao)
  - dashboard operacional
  - busca de licenca
  - provisionamento
  - detalhe de licenca com trilho de decisao
  - acoes administrativas (`renew`, `block`, `unblock`, `cancel`)
- feature flag de mutacoes (`VITE_ADMIN_WEB_ENABLE_MUTATIONS`)
- scripts no root para ciclo do frontend

## Validacoes executadas
No diretorio `apps/admin-web`:

```bash
npm run build
npm run test
npm run test:e2e
```

Resultado:
- build: OK
- unit/integration: OK (6 suites, 10 testes)
- e2e: OK (1 teste Playwright)

## Seguranca validada
- chamadas do navegador usam `/admin-api/*`
- `X-Internal-Api-Key` e injetado no proxy server-side
- nenhum segredo interno com prefixo `VITE_`

## Arquivos principais
- `apps/admin-web/vite.config.ts`
- `apps/admin-web/src/features/api.ts`
- `apps/admin-web/src/features/license-provision/ProvisionLicenseForm.tsx`
- `apps/admin-web/src/features/license-actions/LicenseActionsPanel.tsx`
- `apps/admin-web/src/features/license-detail/LicenseDetailView.tsx`
- `apps/admin-web/e2e/dashboard.spec.ts`

## Observacoes
- chunk final do build acima de 500KB foi sinalizado pelo Vite como warning de bundle size.
- sem impacto funcional imediato para o MVP interno.
