# Mini-spec - Audit Security MVP interno (Fase 9 P2)

Data: 2026-03-04

## Objetivo
Extrair para `audit-security` a persistencia de historico de validacao, eventos de seguranca e logs de auditoria, incluindo contagens para regras de runtime.

## Escopo
- Port interno `AuditSecurityPort`.
- Implementacao Prisma resiliente (`PrismaAuditSecurityService`).
- Substituicao das injecoes do `ValidationAuditRepository` no `license-runtime`.
- Refator do `PrismaLicenseEngineAdapter` para contagem e escrita via port.

## Contrato interno
Metodos:
1. `writeValidationHistory(...)`
2. `writeSecurityEvent(...)`
3. `writeAuditLog(...)`
4. `countAuditLogsSince(...)`

Comportamento:
- Em `NODE_ENV=test`, metodos de persistencia sao no-op e contagem retorna `0`.
- Em falha de banco, operacao nao quebra fluxo (warn + fallback).

## Criterios de aceite
1. `audit-security` deixa de ser placeholder e exporta `AUDIT_SECURITY_PORT`.
2. `license-runtime` nao depende de classe concreta local para auditoria.
3. Sem mudanca de contrato HTTP v2.
4. Testes cobrem cenarios de sucesso e falha resiliente.
