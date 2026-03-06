# POST /api/v2/licenses/heartbeat

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
  "success": true,
  "next_heartbeat": 3600,
  "server_time": 1762201200000
}
```

## Erros comuns
- `403 fingerprint_mismatch`
- `404 license_not_found`
- `401 unauthorized_program`
- `400 invalid_request`
