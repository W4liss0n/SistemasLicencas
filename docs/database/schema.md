# Database Schema (v2)

## Stack de dados
- PostgreSQL como fonte de verdade transacional.
- Prisma ORM para schema, migrations e acesso tipado.

## Entidades principais
- `programs`
- `client_credentials`
- `plans`
- `plan_programs`
- `customers`
- `subscriptions`
- `licenses`
- `device_fingerprints`
- `license_devices`
- `idempotency_keys`
- `validation_history`
- `security_events`
- `audit_logs`
- `outbox_events`

## Modelagem de autenticacao
`client_credentials`:
- `program_id` (FK -> `programs.id`)
- `identifier`
- `password_hash`
- `password_salt`
- `hash_version` (default `scrypt_v1`)
- `is_active`
- `last_authenticated_at`
- unique composto: `(program_id, identifier)`

## Modelagem de licensing
- Licenca (`licenses`) pertence a assinatura (`subscriptions`).
- Dispositivo ativo de licenca em `license_devices` com FK para `device_fingerprints`.
- Fingerprint e persistido por hash deterministico (`sha256:<hex>`).

## Idempotencia
`idempotency_keys` guarda:
- chave
- endpoint
- hash do payload
- status/response serializada
- expiracao (`expires_at`)

## Seed canonico
Arquivo: `apps/api/prisma/seed.ts`
- programa `demo-program`
- credencial `demo@example.com` / `demo123`
- licencas de cenarios de sucesso, bloqueio, expiracao e limite de transferencia
