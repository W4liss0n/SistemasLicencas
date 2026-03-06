# Seguranca - Modelo de Login Offline de Usuario Final

Data de atualizacao: 2026-03-05

## Objetivo
Permitir login offline por ate 72 horas para usuario final apos autenticacao online valida via browser (OIDC + PKCE), sem quebrar o contrato publico de licensing.

## Principios
- `online-first`: sessao offline so existe apos login online autorizado.
- `access_pending` nao cria sessao local nem emite `offline_token`.
- Login online sem senha trafegando no launcher/app.
- Token offline assinado assimetricamente (RS256) e validado localmente por JWKS.
- Vinculo obrigatorio ao dispositivo (`fp_hash`).
- Bloqueio de offline ao detectar tamper de relogio.

## Fluxo online (browser OIDC)
1. App chama `GET /api/v2/auth/oidc/config`.
2. App gera `state`, `nonce` e PKCE (`code_verifier` + `code_challenge` S256).
3. App abre browser do sistema no `authorization_endpoint`.
4. IdP redireciona para loopback local (`http://127.0.0.1:<porta>/callback`) com `authorization_code`.
5. App chama `POST /api/v2/auth/login` com:
   - `authorization_code`
   - `code_verifier`
   - `redirect_uri`
   - `nonce`
   - `device_fingerprint`
6. Backend:
   - troca o codigo no `token_endpoint`;
   - valida `id_token` (`iss`, `aud`, assinatura, `exp`, `nonce`, `sub`, `email`, `email_verified`);
   - encontra ou autocadastra o usuario local quando `END_USER_AUTH_AUTO_PROVISION=true`;
   - resolve usuario + entitlement;
   - se nao houver plano para o programa, retorna `access_pending` sem criar sessao;
   - emite `access_token`, `refresh_token` e `offline_token` RS256.
7. App busca `GET /.well-known/jwks.json` e persiste sessao local segura.

## Fluxo offline no SDK
O SDK salva os anchors:
- `anchor_server_time_ms`
- `anchor_monotonic_ns`
- `last_wall_clock_ms`

Na tentativa offline:
1. valida estrutura da sessao local;
2. detecta rollback de wall clock:
   - se `wall_clock_now + skew < last_wall_clock_ms` -> `clock_tamper_detected`;
3. estima tempo de servidor com monotonic:
   - `estimated_server_now = anchor_server_time + elapsed_monotonic`;
4. valida assinatura do `offline_token` com JWKS;
5. valida `exp` e `nbf`;
6. valida `fp_hash` contra fingerprint atual.

Se qualquer validacao falhar: `offline_not_allowed` (ou `clock_tamper_detected` para tamper).

## Revalidacao ao voltar internet
- App deve executar `POST /api/v2/auth/refresh`.
- Backend revalida status do usuario, entitlement e estado de revogacao da sessao.
- Replay de refresh revoga sessao com `session_revoked`.

## Revogacao e bloqueio administrativo
- Bloqueio (`POST /api/v2/internal/admin/users/:id/block`) revoga sessoes ativas.
- Unblock (`POST /api/v2/internal/admin/users/:id/unblock`) permite novo login online.
- Nao existe reset de senha no fluxo de usuario final desta fase (login e via OIDC browser).

## Limites do modelo
- O objetivo e elevar custo de fraude offline, nao garantir inviolabilidade absoluta no cliente.
- A decisao final de autorizacao continua sendo reforcada no refresh online.
