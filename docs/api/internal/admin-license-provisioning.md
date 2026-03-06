# Operacoes Internas de Licenca

## POST /api/v2/internal/admin/licenses
Provisiona nova licenca para cliente/assinatura.

### Request (exemplo)
```json
{
  "program_code": "demo-program",
  "plan_code": "basic",
  "customer": {
    "email": "cliente@exemplo.com",
    "name": "Cliente Exemplo"
  },
  "subscription_end_at": "2026-12-31T23:59:59.000Z",
  "requested_by": "ops-user"
}
```

### Regras
- programa deve estar ativo
- plano deve existir e estar vinculado ao programa
- cria assinatura `active` com `auto_renew=false` por padrao
- gera `license_key` no formato `LIC-<PROG>-<RANDOM>`

## POST /api/v2/internal/admin/licenses/:licenseKey/renew
Renova validade da assinatura vinculada a licenca.

### Request
```json
{
  "new_end_at": "2027-03-31T23:59:59.000Z",
  "reason": "manual_renewal",
  "requested_by": "ops-user"
}
```

## POST /api/v2/internal/admin/licenses/:licenseKey/block
Bloqueia licenca.

## POST /api/v2/internal/admin/licenses/:licenseKey/unblock
Desbloqueia licenca se assinatura estiver elegivel (`active` e `end_at` no futuro).

## POST /api/v2/internal/admin/licenses/:licenseKey/cancel
Cancela licenca e assinatura vinculada.

## GET /api/v2/internal/admin/licenses/:licenseKey
Retorna visao operacional consolidada de:
- licenca
- assinatura
- plano
- cliente
- dispositivos vinculados

## GET /api/v2/internal/admin/operational-summary
Retorna resumo agregado operacional (totais e janela recente).
