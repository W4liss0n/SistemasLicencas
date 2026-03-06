# Mini-spec - Device Trust MVP interno (Fase 9 P2)

Data: 2026-03-04

## Objetivo
Extrair para o modulo `device-trust` as regras de canonicalizacao de fingerprint e ciclo de vida do vinculo `license_devices`, sem alterar o contrato HTTP publico.

## Escopo
- Novo contrato interno `DeviceTrustPort`.
- Implementacao Prisma em `PrismaDeviceTrustService`.
- Export do port no `DeviceTrustModule`.
- Cobertura de testes unitarios do modulo.
- Integracao do `PrismaLicenseEngineAdapter` via `DEVICE_TRUST_PORT`.

## Contrato interno
Metodos:
1. `parseFingerprint(fingerprint)`
2. `registerDevice({ licenseId, fingerprintHash, rawComponents, matchSource })`
3. `touchDevice({ licenseDeviceId, matchSource })`
4. `replaceActiveDevice({ licenseId, fingerprintHash, rawComponents, matchSource })`
5. `deactivateDevice({ licenseDeviceId, matchSource })`

Retornos:
- sucesso em `parseFingerprint` com:
  - `fingerprintHash` (`sha256` do canonical)
  - `rawComponents` normalizado
- falha em `parseFingerprint` com codigo:
  - `invalid_request`

## Fluxo
1. Normalizar fingerprint em pares `key:value` (`trim`, lowercase de chave, ordenacao).
2. Rejeitar payload vazio com `invalid_request`.
3. Persistir/atualizar `device_fingerprints` via `upsert`.
4. Registrar/tocar/desativar `license_devices` com `matchSource` apropriado.
5. No transfer, inativar vinculos ativos e reativar ou criar vinculo do novo fingerprint.

## Erros mapeados
- `invalid_request`: fingerprint ausente ou sem componentes validos.

## Criterios de aceite
1. `DeviceTrustModule` deixa de ser placeholder e exporta `DEVICE_TRUST_PORT`.
2. `PrismaDeviceTrustService` implementa parsing e operacoes de vinculo de device.
3. `PrismaLicenseEngineAdapter` delega operacoes de device/fingerprint ao modulo.
4. Testes unitarios cobrem parsing, registro, touch, replace e deactivate.
5. Nenhuma mudanca em endpoint, DTO ou OpenAPI.
