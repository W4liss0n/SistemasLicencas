# POST /api/v2/licenses/transfer

## Headers
- `X-Program-Id` (obrigatorio)
- `Idempotency-Key` (obrigatorio)
- `X-Request-Id` (opcional)

## Request
```json
{
  "license_key": "LIC-DEMO-ACTIVE-0001",
  "new_device_fingerprint": {
    "raw_components": {
      "machine_id": "MACHINE-B",
      "disk_serial": "DISK-B",
      "mac_address": "AA:BB:CC:DD:EE:02"
    }
  },
  "reason": "device_replacement"
}
```

## Response 200
```json
{
  "success": true,
  "transfer_count_month": 1,
  "message": "License transferred successfully"
}
```

## Regras
- Limite mensal de transferencia por licenca: 3.
- Ao transferir, dispositivos ativos anteriores da licenca sao desativados.

## Erros comuns
- `429 transfer_limit_exceeded`
- `409 idempotency_key_conflict`
- `401 unauthorized_program`
- `404 license_not_found`
