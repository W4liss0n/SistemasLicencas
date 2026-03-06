# API - Licensing Runtime

## Escopo
Este modulo cobre validacao e ciclo de vida de licenca em `sistema-licencas-v2`.

## Endpoints
- `POST /api/v2/licenses/validate`
- `POST /api/v2/licenses/activate`
- `POST /api/v2/licenses/heartbeat`
- `POST /api/v2/licenses/transfer`
- `POST /api/v2/licenses/deactivate`

## Headers obrigatorios
- Todos os endpoints: `X-Program-Id`
- Mutacoes (`activate`, `transfer`, `deactivate`): `Idempotency-Key`

## Payload base de fingerprint
```json
{
  "raw_components": {
    "machine_id": "MACHINE-A",
    "disk_serial": "DISK-A",
    "mac_address": "AA:BB:CC:DD:EE:01"
  }
}
```

## Semantica principal
- `validate`: consulta licenca e garante consistencia de dispositivo.
- `activate`: registra/reativa dispositivo respeitando limite do plano.
- `heartbeat`: confirma dispositivo ativo e retorna janela para proximo heartbeat.
- `transfer`: move licenca para novo dispositivo com limite mensal.
- `deactivate`: desativa dispositivo atual da licenca.

## Contrato de erro
Todos os erros retornam `application/problem+json` com campos:
- `type`, `title`, `status`, `code`, `detail`, `instance`, `trace_id`

Tabela completa de codigos em [ERROR_MESSAGES_ARCHITECTURE.md](../../ERROR_MESSAGES_ARCHITECTURE.md).
