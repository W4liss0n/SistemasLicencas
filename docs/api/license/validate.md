# POST /api/v2/licenses/validate

## Headers
- `X-Program-Id` (obrigatorio)
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

## Erros comuns
- `400 invalid_request`
- `401 unauthorized_program`
- `404 license_not_found`
- `403 license_blocked`
- `403 subscription_expired`
- `403 program_not_included`
- `403 fingerprint_mismatch`
