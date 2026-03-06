# API Design v2 - Contract First

## Principios
- Contrato publico baseado em OpenAPI em `.openapi/openapi.v2.json`.
- Endpoints estaveis em `/api/v2`.
- Erros padronizados em `application/problem+json`.
- Header `X-Program-Id` obrigatorio para isolamento por programa.
- Idempotencia obrigatoria em mutacoes criticas.

## Superficie publica
- `POST /api/v2/license/authenticate`
- `POST /api/v2/licenses/validate`
- `POST /api/v2/licenses/activate`
- `POST /api/v2/licenses/heartbeat`
- `POST /api/v2/licenses/transfer`
- `POST /api/v2/licenses/deactivate`
- `GET /api/v2/health`
- `GET /api/v2/metrics` (feature-flag)

## Padrao de sucesso
- `2xx` com payload JSON especifico por endpoint.
- Header `x-request-id` sempre presente no response.

## Padrao de falha
```json
{
  "type": "https://docs.sistema-licencas.dev/problems/<code>",
  "title": "Human readable title",
  "status": 4,
  "code": "domain_code",
  "detail": "Human readable detail",
  "instance": "/api/v2/licenses/validate",
  "trace_id": "uuid"
}
```

## Idempotencia
`activate`, `transfer`, `deactivate` usam a tabela `idempotency_keys`:
- mesma chave e mesmo payload: replay.
- mesma chave com payload diferente: `409 idempotency_key_conflict`.

## Compatibilidade com legado
Compatibilidade e semantica, nao byte-a-byte. O gate oficial esta em:
- `npm run test:legacy:local`
- `docs/rewrite-v2/compatibility-matrix.generated.md`

## Observabilidade minima
- traces via OpenTelemetry (opcional por env)
- metricas Prometheus em endpoint interno
- correlacao por `trace_id`/`x-request-id`

## Checklist de release de contrato
1. `npm run openapi:generate`
2. `npm run openapi:validate`
3. `npm run test`
4. `npm run test:legacy:local`
5. `npm run docs:lint`
