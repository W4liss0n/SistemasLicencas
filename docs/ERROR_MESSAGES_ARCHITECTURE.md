# Arquitetura de Mensagens de Erro (v2)

## Contrato unico de erro
Todos os erros da API publica usam `application/problem+json`.

Formato:
```json
{
  "type": "https://docs.sistema-licencas.dev/problems/<code>",
  "title": "Human readable title",
  "status": 400,
  "code": "domain_code",
  "detail": "Human readable detail",
  "instance": "/api/v2/licenses/validate",
  "trace_id": "c5da4ebf-2ad7-44f5-a13e-64db8ce5a9c8"
}
```

## Campos
- `type`: URI semantica do problema
- `title`: titulo resumido
- `status`: status HTTP
- `code`: codigo canonico de dominio
- `detail`: mensagem para diagnostico
- `instance`: path da requisicao
- `trace_id`: correlacao com logs/telemetria

## Codigos canonicos de dominio
| code | status | quando ocorre |
|---|---|---|
| `invalid_request` | 400 | payload invalido ou header obrigatorio ausente |
| `unauthorized_program` | 401 | `X-Program-Id` ausente/invalido/inativo |
| `invalid_credentials` | 401 | credencial de cliente invalida |
| `access_pending` | 403 | identidade autenticada existe localmente, mas ainda aguarda liberacao de plano |
| `license_not_found` | 404 | chave de licenca inexistente |
| `license_blocked` | 403 | licenca bloqueada/inativa |
| `subscription_expired` | 403 | assinatura expirada/inativa |
| `program_not_included` | 403 | programa nao incluso no plano |
| `fingerprint_mismatch` | 403 | dispositivo nao corresponde ao ativo |
| `max_devices_reached` | 409 | limite de dispositivos atingido |
| `idempotency_key_conflict` | 409 | conflito de idempotencia |
| `transfer_limit_exceeded` | 429 | limite mensal de transferencias atingido |
| `rate_limit_exceeded` | 429 | limite global de requests atingido |
| `internal_error` | 500 | erro nao tratado |

## Header de correlacao
- response sempre retorna `x-request-id`
- `trace_id` no corpo deve ser igual ao identificador de correlacao usado no request lifecycle

## Regras de observabilidade
- erros `4xx/5xx` em endpoints de licensing incrementam `license_runtime_failures_total`
- replays idempotentes incrementam `idempotency_replay_total`
