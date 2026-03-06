# Seguranca - Rate Limiting e Idempotencia

## Rate limiting HTTP
Configurado globalmente no bootstrap da API:
- janela: 1 minuto
- limite: 100 requests por cliente

Quando excede:
- status: `429`
- code: `rate_limit_exceeded`
- content-type: `application/problem+json`

## Headers retornados
- `x-ratelimit-limit`
- `x-ratelimit-remaining`
- `x-ratelimit-reset`

## Idempotencia para mutacoes
Endpoints:
- `POST /api/v2/licenses/activate`
- `POST /api/v2/licenses/transfer`
- `POST /api/v2/licenses/deactivate`

Regras:
- mesma chave + mesmo payload -> replay da resposta original
- mesma chave + payload diferente -> `409 idempotency_key_conflict`
- chave em processamento concorrente -> `409 idempotency_key_conflict`

## Persistencia
- tabela: `idempotency_keys`
- campos chave: `idempotency_key`, `endpoint`, `request_hash`, `status_code`, `response_body`, `expires_at`
- TTL configuravel por `IDEMPOTENCY_TTL_HOURS`

## Metricas associadas
- `http_requests_total`
- `http_request_duration_ms`
- `license_runtime_failures_total`
- `idempotency_replay_total`
