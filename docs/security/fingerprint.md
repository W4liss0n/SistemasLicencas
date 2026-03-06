# Seguranca - Fingerprint de Dispositivo

Data de atualizacao: 2026-03-05

## Entrada esperada
A API recebe `device_fingerprint.raw_components` como mapa chave/valor.

Exemplo:
```json
{
  "raw_components": {
    "machine_id": "MACHINE-A",
    "disk_serial": "DISK-A",
    "mac_address": "AA:BB:CC:DD:EE:01"
  }
}
```

## Normalizacao
1. chaves em lowercase com trim
2. valores com trim
3. remove pares vazios
4. ordena por chave
5. serializa como `k:v|k:v|...`

## Hash
- Algoritmo: SHA-256
- Formato persistido: `sha256:<hex>`
- Persistencia de runtime de licenca: `device_fingerprints`
- Persistencia de sessao de usuario final: `end_user_sessions.device_fingerprint_hash`

## Estrategias offline

### `legacy_hmac`
- Aplicada aos endpoints publicos legados de licensing (`/api/v2/licenses/*`).
- Emissao de `offline_token` via HMAC SHA-256 com segredo do servidor.

### `rs256_offline_session`
- Aplicada ao login de usuario final (`/api/v2/auth/login` e `/api/v2/auth/refresh`).
- Emissao de JWS RS256 com claims:
  - `sub`
  - `sid`
  - `program_id`
  - `fp_hash`
  - `iat` / `nbf` / `exp`
  - `entitlements`
- Validacao por chave publica distribuida em `/.well-known/jwks.json`.

## Regras de runtime (licensing)
- `validate`: aceita somente dispositivo ativo atual ou registra primeiro dispositivo.
- `activate`: respeita limite de dispositivos do plano.
- `heartbeat`: exige match exato de fingerprint ativo.
- `deactivate`: desativa apenas fingerprint ativo correspondente.

## Regras de runtime (auth de usuario final)
- Login online exige fingerprint valido e vincula sessao ao `fp_hash`.
- Refresh exige o mesmo fingerprint da sessao.
- Divergencia de fingerprint no refresh retorna `offline_not_allowed`.

## Erros relacionados
- `fingerprint_mismatch`
- `offline_not_allowed`
- `clock_tamper_detected`
- `invalid_request` (payload ausente/invalido)
