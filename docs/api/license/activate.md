# POST /api/v2/licenses/activate

## Headers
- `X-Program-Id` (obrigatorio)
- `Idempotency-Key` (obrigatorio)
- `X-Request-Id` (opcional)

## Request
```json
{
  "license_key": "LIC-DEMO-ACTIVE-0001",
  "device_fingerprint": {
    "raw_components": {
      "machine_id": "MACHINE-A",
      "disk_serial": "DISK-A",
      "mac_address": "AA:BB:CC:DD:EE:01"
    }
  },
  "program_version": "2.3.1",
  "os_info": "Windows 11"
}
```

## Response 200
```json
{
  "success": true,
  "valid": true,
  "license_info": {
    "license_key": "LIC-DEMO-ACTIVE-0001",
    "expiration": "2026-12-31T23:59:59.000Z",
    "plan_name": "Basic",
    "max_offline_hours": 72,
    "features": ["validate", "heartbeat"]
  },
  "offline_token": "<token>",
  "security": {
    "risk_score": 0.1,
    "warnings": [],
    "next_heartbeat": 3600
  }
}
```

## Idempotencia
- Mesmo `Idempotency-Key` + mesmo payload: replay da mesma resposta.
- Mesmo `Idempotency-Key` + payload diferente: `409 idempotency_key_conflict`.

## Erros comuns
- `409 max_devices_reached`
- `409 idempotency_key_conflict`
- Demais codigos de validacao de licenca.
