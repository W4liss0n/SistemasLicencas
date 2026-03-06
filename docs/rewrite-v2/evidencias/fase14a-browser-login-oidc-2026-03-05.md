# Evidencia - Fase 14A Browser Login OIDC (2026-03-05)

## Escopo executado
- Migracao de login de usuario final para `OIDC Authorization Code + PKCE` via browser.
- Manutencao de sessao interna (`access_token`, `refresh_token`) e `offline_token` RS256.
- Ajustes de contrato, persistencia, SDK Python, metricas e documentacao.

## Principais entregas
1. Backend:
   - `GET /api/v2/auth/oidc/config`.
   - `POST /api/v2/auth/login` com `authorization_code`, `code_verifier`, `redirect_uri`, `nonce` e fingerprint.
   - Servico OIDC provider-agnostic com discovery, code exchange e validacao de `id_token`.
2. Dados:
   - `EndUser` com `oidc_issuer`, `oidc_subject`, `email_verified_at`.
   - unique `(oidc_issuer, oidc_subject)`.
3. Admin interno:
   - criacao de usuario sem senha;
   - remocao do endpoint de reset-password na API interna.
4. SDK Python:
   - login por browser com PKCE `S256` e callback loopback `127.0.0.1`;
   - fluxo de refresh/logout/offline preservado.
5. Observabilidade:
   - `auth_oidc_login_success_total`
   - `auth_oidc_login_failure_total`
   - `auth_oidc_code_exchange_failure_total`

## Validacoes locais executadas
- `npm run prisma:generate` -> OK
- `npm run typecheck` -> OK
- `npm run test` -> OK (20 suites, 93 testes)
- `python -m pytest -q` em `sdk/python` -> OK (8 passed, 2 skipped)

## Notas de conformidade com o plano
- Fluxo de login por senha para usuario final foi removido do endpoint `POST /api/v2/auth/login`.
- `refresh`, `logout`, `me` e modelo offline permanecem ativos.
- Limpeza fisica completa de campos/servicos legados de senha ficou fora do escopo desta fase (conforme plano).
