# Mini-spec - Subscription MVP interno (Fase 9 P2)

Data: 2026-03-04

## Objetivo
Extrair para o modulo `subscription` a responsabilidade de carregar e validar o contexto elegivel de assinatura/licenca, sem alterar contrato HTTP publico.

## Escopo
- Novo contrato interno `SubscriptionReadPort`.
- Implementacao Prisma em `PrismaSubscriptionReadService`.
- Export do port no `SubscriptionModule`.
- Cobertura de testes unitarios do modulo.

## Contrato interno
`SubscriptionReadPort.loadEligibleLicense(licenseKey: string)`

Retornos:
- sucesso com contexto de:
  - `license` (`id`, `licenseKey`, `maxOfflineHours`)
  - `subscription` (`id`, `planId`, `status`, `endAt`)
  - `devices` ativos/inativos com `id` e `fingerprintHash`
- falha com codigos:
  - `license_not_found`
  - `license_blocked`
  - `subscription_expired`

## Fluxo
1. Ler licenca por `licenseKey` com `subscription` e `devices`.
2. Validar existencia da licenca.
3. Validar status da licenca (`active`).
4. Validar status/vigencia da assinatura (`active` e `endAt > now`).
5. Retornar contexto normalizado para consumo do `license-runtime`.

## Erros mapeados
- `license_not_found`: licenca inexistente.
- `license_blocked`: `license.status` diferente de `active`.
- `subscription_expired`: assinatura inativa ou expirada.

## Criterios de aceite
1. `SubscriptionModule` deixa de ser placeholder e exporta `SUBSCRIPTION_READ_PORT`.
2. `PrismaSubscriptionReadService` implementa o port com os codigos canonicos acima.
3. Testes unitarios validam caminhos de sucesso e falha.
4. Nenhuma mudanca em endpoint, DTO ou OpenAPI.
