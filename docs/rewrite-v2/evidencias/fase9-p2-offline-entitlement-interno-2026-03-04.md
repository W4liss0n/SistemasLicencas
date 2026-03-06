# Evidencia local - Fase 9 (P2) Offline Entitlement interno

Data: 2026-03-04
Workspace: `SistemaLicencas`

## Entregas
- modulo `offline-entitlement` implementado com `OFFLINE_ENTITLEMENT_PORT`.
- `HmacOfflineEntitlementService` adicionado.
- `PrismaLicenseEngineAdapter` refatorado para emissao offline via port.
- teste unitario de emissao adicionado.
- mini-spec publicada: `docs/rewrite-v2/mini-spec-offline-entitlement-mvp-interno.md`.

## Resultado
- emissao de token offline desacoplada do adapter Prisma.
- payload publico (`offline_token`) preservado.
