# Mini-spec - Offline Entitlement MVP interno (Fase 9 P2)

Data: 2026-03-04

## Objetivo
Extrair a emissao de token offline para `offline-entitlement`, mantendo formato e semantica atuais do adapter Prisma.

## Escopo
- Port interno `OfflineEntitlementPort`.
- Implementacao `HmacOfflineEntitlementService`.
- Refator do `PrismaLicenseEngineAdapter` para consumir `OFFLINE_ENTITLEMENT_PORT`.

## Contrato interno
Metodo:
1. `issueOfflineToken({ licenseKey, fingerprintHash, issuedAt? })`

Retorno:
- token HMAC SHA-256 em formato hex.

## Fluxo
1. Receber contexto de licenca + fingerprint hash.
2. Gerar assinatura HMAC com `JWT_SECRET`.
3. Retornar token para respostas de `validate`/`activate`.

## Criterios de aceite
1. `offline-entitlement` deixa de ser placeholder e exporta `OFFLINE_ENTITLEMENT_PORT`.
2. `PrismaLicenseEngineAdapter` nao contem mais algoritmo local de emissao offline.
3. Sem alteracao de payload HTTP (`offline_token` permanece igual em contrato).
4. Testes unitarios cobrem determinismo e variacao por fingerprint.
