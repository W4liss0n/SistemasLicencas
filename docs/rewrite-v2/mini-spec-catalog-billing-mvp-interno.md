# Mini-spec - Catalog Billing MVP interno (Fase 9 P2)

Data: 2026-03-04

## Objetivo
Extrair para o modulo `catalog-billing` as regras de autorizacao de programa e politica de plano (inclusao plano-programa e limites), sem alterar API publica.

## Escopo
- Novo contrato interno `CatalogBillingPolicyPort`.
- Implementacao Prisma em `PrismaCatalogBillingPolicyService`.
- Export do port no `CatalogBillingModule`.
- Cobertura de testes unitarios do modulo.

## Contrato interno
Metodos:
1. `resolveAuthorizedProgram(programId: string)`
2. `resolveProgramPolicy({ programId, planId })`

Retornos:
- sucesso com:
  - programa autorizado (`id`, `code`)
  - politica do plano (`planId`, `planName`, `maxDevices`, `features`)
- falha com codigos:
  - `unauthorized_program`
  - `program_not_included`

## Fluxo
1. Resolver programa ativo por `id` ou `code`.
2. Retornar `unauthorized_program` se nao encontrado/inativo.
3. Resolver plano por `planId` e verificar vinculo em `plan_programs`.
4. Retornar `program_not_included` quando o plano nao inclui o programa.
5. Retornar politica normalizada de plano para consumo do `license-runtime`.

## Erros mapeados
- `unauthorized_program`: programa nao autorizado para o runtime.
- `program_not_included`: plano da assinatura nao cobre o programa informado.

## Criterios de aceite
1. `CatalogBillingModule` deixa de ser placeholder e exporta `CATALOG_BILLING_POLICY_PORT`.
2. `PrismaCatalogBillingPolicyService` implementa os dois metodos do port.
3. Testes unitarios cobrem autorizacao de programa, inclusao de plano e sucesso.
4. Sem mudanca de endpoint, DTO e comportamento HTTP.
