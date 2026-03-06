# Evidencia local - Fase 9 (P2) Subscription + Catalog Billing interno

Data: 2026-03-04
Workspace: `SistemaLicencas`

## Objetivo da rodada
Executar o MVP interno da fase 9 (P2): extrair regras de `subscription` e `catalog-billing` para modulos dedicados, mantendo paridade funcional do runtime publico v2.

## Entregas tecnicas
- `subscription` deixou de ser placeholder e passou a exportar `SUBSCRIPTION_READ_PORT`.
- `catalog-billing` deixou de ser placeholder e passou a exportar `CATALOG_BILLING_POLICY_PORT`.
- `PrismaLicenseEngineAdapter` foi refatorado para delegar:
  - leitura/validacao de licenca-assinatura para `SubscriptionReadPort`
  - autorizacao de programa e politica de plano para `CatalogBillingPolicyPort`
- testes unitarios adicionados para os dois modulos.
- mini-specs publicadas:
  - `docs/rewrite-v2/mini-spec-subscription-mvp-interno.md`
  - `docs/rewrite-v2/mini-spec-catalog-billing-mvp-interno.md`

## Gates executados
1. `npm run typecheck` -> OK
2. `npm run test` -> OK
3. `npm run test:contract:fake` -> OK
4. `npm run test:contract:prisma` -> OK
5. `npm run openapi:generate` -> OK
6. `npm run openapi:validate` -> OK
7. `npm run docs:lint` -> OK
8. `npm run test:legacy:local` -> OK

## Observacoes operacionais
- `test:legacy:local` executou com sucesso na workspace atual.
- ocorreu falha transiente no `legacy migrate` na primeira tentativa durante subida oracle; o retry automatico recuperou e o gate concluiu com sucesso.
- aviso deprecado do Prisma (`package.json#prisma`) permaneceu sem acao nesta fase.

## Resultado
Fase 9 (P2) iniciada com sucesso para `subscription` e `catalog-billing`, mantendo contrato HTTP v2 inalterado e cobertura de gates completa.