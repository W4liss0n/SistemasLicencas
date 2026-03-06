# Mini-spec - Fase 10 Provisionamento Interno

Data: 2026-03-04  
Status: implementado (entrega inicial)

## Objetivo
Habilitar operacao interna de provisionamento e gestao manual de licencas sem alterar o contrato publico de licensing.

## Escopo funcional
- provisionar licenca por API interna
- renovar validade
- bloquear/desbloquear
- cancelar licenca
- consultar detalhes operacionais da licenca
- expor resumo operacional existente por endpoint interno

## Fora de escopo
- novos endpoints publicos para clientes finais
- automacao de billing/webhook para renovacao
- migrations de banco

## Endpoints internos
- `POST /api/v2/internal/admin/licenses`
- `POST /api/v2/internal/admin/licenses/:licenseKey/renew`
- `POST /api/v2/internal/admin/licenses/:licenseKey/block`
- `POST /api/v2/internal/admin/licenses/:licenseKey/unblock`
- `POST /api/v2/internal/admin/licenses/:licenseKey/cancel`
- `GET /api/v2/internal/admin/licenses/:licenseKey`
- `GET /api/v2/internal/admin/operational-summary`

## Seguranca
- header obrigatorio `X-Internal-Api-Key`
- validacao via `InternalApiKeyGuard` com comparacao segura
- mutacoes exigem `Idempotency-Key`

## Regras de negocio
1. Provisionamento
- programa deve estar ativo
- plano deve existir e estar vinculado ao programa em `plan_programs`
- cliente por email com upsert
- assinatura criada com `status=active`, `startAt` (default agora), `endAt` obrigatorio e `autoRenew=false` por padrao
- chave no formato `LIC-<PROG>-<RANDOM>`
- `max_offline_hours` herdado do plano (ou override explicito)
- auditoria: `admin_license_provision`

2. Renovacao
- atualiza `subscription.endAt`
- normaliza assinatura para `active`
- auditoria: `admin_license_renew`

3. Bloqueio/Desbloqueio
- `block`: `license.status=blocked`
- `unblock`: `license.status=active` somente com assinatura elegivel (`active` e `endAt` futuro)
- auditoria: `admin_license_block`, `admin_license_unblock`

4. Cancelamento
- `license.status=inactive`
- `subscription.status=cancelled`
- auditoria: `admin_license_cancel`

## Contratos
- respostas de erro seguem `application/problem+json`
- controller interno marcado com `@ApiExcludeController()` para nao entrar no OpenAPI publico

## Validacao de entrega
- unitarios de guard e servico interno
- e2e do fluxo `provision -> block -> unblock -> renew -> cancel`
- regressao dos gates globais (`typecheck`, `test`, contratos, openapi e docs)
