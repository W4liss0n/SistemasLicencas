# POST /api/v2/licenses/deactivate

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
  }
}
```

## Response 200
```json
{
  "success": true,
  "message": "Device deactivated successfully"
}
```

## Erros comuns
- `403 fingerprint_mismatch`
- `409 idempotency_key_conflict`
- `404 license_not_found`
- `401 unauthorized_program`
