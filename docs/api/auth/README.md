# API - Auth v2 (Browser OIDC + Sessao Offline)

Data de atualizacao: 2026-03-05

## Objetivo
Documentar o fluxo de autenticacao de usuario final com:
- login via browser (OIDC Authorization Code + PKCE);
- sessao online (`access` + `refresh`);
- continuidade offline segura via token RS256.

## Endpoints publicos
- `GET /api/v2/auth/oidc/config`
- `POST /api/v2/auth/login`
- `POST /api/v2/auth/refresh`
- `POST /api/v2/auth/logout`
- `GET /api/v2/auth/me`
- `GET /.well-known/jwks.json`

## Endpoints internos de administracao de usuario final
- `POST /api/v2/internal/admin/users`
- `PATCH /api/v2/internal/admin/users/:id`
- `POST /api/v2/internal/admin/users/:id/block`
- `POST /api/v2/internal/admin/users/:id/unblock`

## Headers relevantes
- Obrigatorio em `login`, `refresh`, `logout`, `me`: `X-Program-Id`
- `GET /api/v2/auth/oidc/config` e `GET /.well-known/jwks.json` nao exigem `X-Program-Id`
- Opcional para correlacao: `X-Request-Id`
- `Authorization: Bearer <access_token>` no `GET /api/v2/auth/me`

## Config OIDC (`GET /api/v2/auth/oidc/config`)
Response:
```json
{
  "issuer": "https://issuer.example.com",
  "client_id": "launcher-client",
  "authorization_endpoint": "https://issuer.example.com/authorize",
  "token_endpoint": "https://issuer.example.com/oauth/token",
  "scopes": ["openid", "profile", "email"]
}
```

## Login (`POST /api/v2/auth/login`)
Payload:
```json
{
  "authorization_code": "code-from-callback",
  "code_verifier": "pkce-code-verifier",
  "redirect_uri": "http://127.0.0.1:53123/callback",
  "nonce": "nonce-generated-by-client",
  "device_fingerprint": {
    "raw_components": {
      "machine_id": "MACHINE-A",
      "disk_serial": "DISK-A",
      "mac_address": "AA:BB:CC:DD:EE:01"
    }
  }
}
```

Response:
```json
{
  "success": true,
  "access_token": "<jwt>",
  "access_expires_at": "2026-03-05T15:00:00.000Z",
  "refresh_token": "<jwt>",
  "refresh_expires_at": "2026-03-12T15:00:00.000Z",
  "offline_token": "<jws-rs256>",
  "offline_expires_at": "2026-03-08T15:00:00.000Z",
  "server_time_ms": 1772722800000,
  "max_offline_hours": 72,
  "entitlements": [
    {
      "customer_id": "44444444-4444-4444-8444-444444444444",
      "subscription_id": "55555555-5555-4555-8555-555555555555",
      "plan_code": "basic",
      "plan_name": "Basic",
      "program_id": "33333333-3333-4333-8333-333333333333",
      "program_code": "demo-program",
      "features": ["validate", "heartbeat"]
    }
  ]
}
```

## Refresh (`POST /api/v2/auth/refresh`)
- Exige `refresh_token` valido e mesmo `device_fingerprint` da sessao.
- Faz rotacao de `access_token` e `refresh_token`.
- Reemite `offline_token` no mesmo vinculo de dispositivo.

## Logout (`POST /api/v2/auth/logout`)
- Revoga a sessao associada ao refresh enviado.
- Retorna `{ "success": true }`.

## Perfil autenticado (`GET /api/v2/auth/me`)
- Valida `access_token` + sessao ativa.
- Retorna identidade do usuario final e entitlement atual para o programa.

## JWKS (`GET /.well-known/jwks.json`)
- Publica chave publica com `kid` ativo para validacao local do `offline_token`.
- Usado por SDKs/apps cliente para validar assinatura RS256 sem rede.

## Erros canonicos
- `offline_not_allowed`
- `clock_tamper_detected`
- `access_pending`
- `entitlement_denied`
- `session_revoked`
- `user_blocked`
- `invalid_credentials`
- `unauthorized_program`

## Notas de seguranca
- Login online via browser (sem senha trafegando no launcher/app).
- OIDC com Authorization Code + PKCE (`S256`) e validacao de `nonce`.
- Access e refresh: JWT interno.
- Offline token: JWS RS256 assinado no backend.
- Sessao vinculada por hash de fingerprint (`device_fingerprint_hash`).
- Bloqueio administrativo de usuario revoga sessoes ativas.

## Quickstart local (mock OIDC)
No `sistema-licencas-v2`:
1. Preparar stack de auth para teste local:
   - `npm run dev:auth`
2. Rodar smoke de login browser com SDK:
   - `cd sdk/python`
   - `set PYTHONPATH=src` (Windows cmd) ou `$env:PYTHONPATH='src'` (PowerShell)
   - `python examples/browser_login_smoke.py`
3. Smoke headless (sem abrir browser) para validacao automatizada:
   - `python examples/browser_login_headless_smoke.py`
4. Encerrar quando terminar:
   - `Ctrl+C` no terminal onde `npm run dev:auth` estiver rodando

Atalho alternativo em background:
- `powershell -ExecutionPolicy Bypass -File scripts/dev/prepare-browser-auth.ps1`
- Para encerrar esse modo, use `powershell -ExecutionPolicy Bypass -File scripts/dev/stop-browser-auth.ps1`

## Integracao direta com Auth0
Use este modo quando quiser trocar o provider mock por tenant real.

1. Configure a aplicacao no Auth0:
   - Application Type: `Native`
   - Token Endpoint Authentication Method: `None`
   - Allowed Callback URLs: `http://127.0.0.1:53123/callback`
   - Allowed Logout URLs: `http://127.0.0.1:53123/`
   - Garanta que o usuario do Auth0 tenha `email_verified=true`.
2. Ajuste o `.env` do backend (`apps/api/.env`):
   - `END_USER_AUTH_ENABLED=true`
   - `END_USER_AUTH_AUTO_PROVISION=true` para habilitar autocadastro local no primeiro login
   - `OIDC_ISSUER_URL=https://<SEU_TENANT_AUTH0>`
   - `OIDC_CLIENT_ID=<CLIENT_ID_DO_AUTH0>`
   - `OIDC_SCOPES=openid profile email`
3. Suba backend sem o mock OIDC:
   - `npm run dev -- --api-only --with-infra --migrate --seed`
4. Rode o smoke browser (porta fixa 53123):
   - `cd sdk/python`
   - `$env:PYTHONPATH='src'`
   - `python examples/browser_login_smoke.py`

Observacao:
- O backend exige `redirect_uri` no formato `http://127.0.0.1:<port>`.
- Com `END_USER_AUTH_AUTO_PROVISION=false`, o `email` do Auth0 deve existir em `end_users.identifier`.
- Com `END_USER_AUTH_AUTO_PROVISION=true`, o backend cria `customer` + `end_user` no primeiro login online bem-sucedido.
- Se o cliente ainda nao tiver plano/subscription para o programa, o login retorna `403 access_pending` com detalhe `User account is awaiting plan assignment`.
- O `offline_token` so e emitido quando o login online encontra entitlement valido para o `X-Program-Id`.
