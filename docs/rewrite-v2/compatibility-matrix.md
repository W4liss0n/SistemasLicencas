# Legacy vs v2 Compatibility Matrix

## Scope

Semantic comparison between legacy API (`/api/v1`) and rewrite API (`/api/v2`) for licensing runtime flows.

## Accepted Differences

| Topic | Legacy v1 | v2 | Status |
|---|---|---|---|
| Error format | `{ error, code, message }` (varies by endpoint) | `application/problem+json` with `trace_id` | Accepted (intentional) |
| Header policy | Program header varies by route/middleware | `X-Program-Id` required in all public licensing endpoints | Accepted (intentional hardening) |
| Idempotency | Not enforced uniformly | `Idempotency-Key` required on mutating endpoints (`activate`, `transfer`, `deactivate`) | Accepted (intentional) |
| Validation endpoint path | `/api/v1/license/validate` | `/api/v2/licenses/validate` | Accepted (versioning) |
| Heartbeat failure behavior | Some flows return `200` with error payload | Canonical HTTP error + `problem+json` | Accepted (intentional) |
| Traceability | Inconsistent request correlation | `X-Request-Id` + `trace_id` in payload | Accepted (improvement) |

## Golden Test Runner

Use:

```bash
LEGACY_BASE_URL=http://localhost:3000 \
V2_BASE_URL=http://localhost:3001 \
V2_PROGRAM_ID=demo-program \
npm run test:legacy
```

Optional legacy headers:

- `LEGACY_API_KEY`
- `LEGACY_PROGRAM_ID`

Generated report output:

- `docs/rewrite-v2/compatibility-matrix.generated.md`

## Scenario Catalog (Runner)

Current runner scenarios:

1. `authenticate_invalid_credentials`
2. `validate_bad_payload`
3. `activate_invalid_payload_or_license`
4. `heartbeat_unknown_license`
5. `transfer_unknown_license`
6. `deactivate_unknown_license`

Compatibility gate policy:

- **Semantic gate with accepted divergences** (`compatible=yes` when behavior is equivalent even if status/code taxonomy differs in accepted ways).

## Execution Evidence (2026-03-04)

### Last full run with both systems online

| Scenario | Legacy | v2 | Result | Classification |
|---|---|---|---|---|
| `authenticate_invalid_credentials` | HTTP `400`, `invalid_credentials` | HTTP `401`, `invalid_credentials` | Compatible | Accepted divergence (status code detail differs, behavior equivalent: both reject invalid credentials) |
| `validate_bad_payload` | HTTP `400`, `VALIDATION_ERROR` | HTTP `400`, `invalid_request` | Compatible | Accepted divergence (error code taxonomy differs, behavior equivalent: both reject malformed payload) |

### Last local runner invocation in this cycle

- Command: `npm run test:legacy`
- Result: skipped by design because `LEGACY_BASE_URL` and `V2_BASE_URL` were not provided in the environment.

### Runtime v2 smoke evidence (Prisma local, 2026-03-04)

Infra and seed:

- `docker compose up -d postgres redis`
- `npm run prisma:migrate:deploy`
- `npm run prisma:seed`

Observed responses:

| Scenario | v2 result |
|---|---|
| `authenticate_demo_credentials` | HTTP `200` |
| `validate_active_license` | HTTP `200` |
| `activate_active_license` | HTTP `200` |
| `heartbeat_active_device` | HTTP `200` |
| `transfer_active_license` | HTTP `200` |
| `deactivate_active_device` | HTTP `200` |
| `transfer_limit_exceeded` (`LIC-LIM-TRN-0004`) | HTTP `429`, `transfer_limit_exceeded` |
| `idempotency_conflict` (same key, payload diferente) | HTTP `409`, `idempotency_key_conflict` |

### Non-Accepted Divergences

- None registered in the last full run.
