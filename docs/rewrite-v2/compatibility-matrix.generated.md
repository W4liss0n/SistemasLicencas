# Compatibility Matrix (Generated)

Generated at: 2026-03-26T00:24:15.382Z

## Semantic Gate

- Accepted divergences:
  - Error payload format and taxonomy differences (`problem+json` vs legacy shape).
  - HTTP status variation within failure class when both sides reject equivalent semantics.
- Non-accepted divergences:
  - Success/error inversion in paired scenarios.
  - Authorization semantic regressions in expected-success flows.
  - Required-header regression in v2 mutating endpoints.

Summary: 12 scenarios, 0 non-accepted divergence(s).

| Scenario | Legacy Status | v2 Status | Legacy Outcome | v2 Outcome | Legacy Code | v2 Code | Compatible | Divergence | Note |
|---|---:|---:|---|---|---|---|---|---|---|
| authenticate_invalid_credentials | 401 | 401 | unauthorized | unauthorized | invalid_credentials | invalid_credentials | yes | none | Both runtimes reject invalid credentials. |
| authenticate_success | 200 | 200 | success | success | n/a | n/a | yes | none | Both runtimes authenticate seeded credentials. |
| validate_bad_payload | 400 | 400 | client_error | client_error | VALIDATION_ERROR | invalid_request | yes | accepted | Both runtimes reject malformed validate payload. |
| validate_unknown_license | 200 | 404 | not_found | not_found | license_not_found | license_not_found | yes | accepted | Both runtimes reject unknown license key. |
| validate_success | 200 | 200 | success | success | n/a | n/a | yes | none | Both runtimes validate active license. |
| activate_success | 200 | 200 | success | success | n/a | n/a | yes | none | Both runtimes activate license on current device. |
| heartbeat_success | 200 | 200 | success | success | n/a | n/a | yes | none | Both runtimes heartbeat current device. |
| transfer_success | 200 | 200 | success | success | n/a | n/a | yes | none | Both runtimes transfer active license to another device. |
| transfer_idempotency_replay | 200 | 200 | success | success | n/a | n/a | yes | none | Replay probe: legacy first=200, legacy second=200, v2 first=200, v2 second=200. |
| transfer_limit_exceeded | 429 | 429 | rate_limited | rate_limited | transfer_limit_exceeded | transfer_limit_exceeded | yes | none | Both runtimes reject transfer when monthly limit is exceeded. |
| deactivate_success | 200 | 200 | success | success | n/a | n/a | yes | none | Both runtimes deactivate device binding. |
| v2_required_header_guard | n/a | 400 | unreachable | client_error | n/a | invalid_request | yes | accepted | v2 mutating endpoint must reject missing Idempotency-Key. |