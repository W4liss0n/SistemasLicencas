# Runbook - Full-stack Docker no Windows (Admin + Backend Publico)

Data de referencia: 2026-03-05

## Objetivo
Subir stack completa do `sistema-licencas-v2` em um host Windows com Docker Desktop:
- painel administrativo com Basic Auth;
- API publica v2 para autenticacao/licenciamento de apps;
- API interna admin protegida e sem exposicao direta;
- DDNS com Cloudflare para IP dinamico.

## Pre-requisitos
- Docker Desktop ativo no Windows.
- Porta `443/TCP` liberada no host.
- Port forwarding `443 -> <ip-local-host-windows>:443` no roteador.
- Dominio gerenciado na Cloudflare.
- Certificado Cloudflare Origin (`.crt` + `.key`).

## Estrutura de arquivos esperada
- `docker-compose.prod.yml`
- `.env.prod` (criado a partir de `.env.prod.example`)
- `ops/admin-gateway/.htpasswd`
- `ops/admin-gateway/certs/origin.crt`
- `ops/admin-gateway/certs/origin.key`

## Passo 1 - Preparar variaveis
```powershell
cd C:\Users\walis\Desktop\Programas\SistemaLicencas
Copy-Item .env.prod.example .env.prod
```

Ajustar obrigatoriamente no `.env.prod`:
- `PUBLIC_DOMAIN=admin.seu-dominio.com`
- `BASIC_AUTH_USER=admin`
- `POSTGRES_PASSWORD=<senha-forte-do-postgres>`
- `DATABASE_URL=postgresql://postgres:<mesma-senha-do-postgres>@postgres:5432/sistema_licencas_v2`
- `JWT_SECRET=<segredo-forte>`
- `ACCESS_JWT_SECRET=<segredo-forte-para-access-token>` (diferente de `JWT_SECRET`)
- `REFRESH_JWT_SECRET=<segredo-forte-para-refresh-token>` (diferente de `JWT_SECRET` e de `ACCESS_JWT_SECRET`)
- `AUTH_PASSWORD_PEPPER=<pepper-forte-para-credenciais>`
- `INTERNAL_ADMIN_API_KEYS=<chave-interna-forte>`
- `ADMIN_INTERNAL_API_KEY=<mesma-chave-interna-forte>`
- `CORS_ALLOWED_ORIGINS=https://admin.seu-dominio.com`
- `ADMIN_AUTH_ENABLED=false` (habilitar depois que Auth0 estiver configurado)
- `ADMIN_AUTH_ISSUER_URL=https://tenant.example.auth0.com/`
- `ADMIN_AUTH_AUDIENCE=<identifier-da-api-auth0-admin>`
- `ADMIN_AUTH_REQUIRED_SCOPES=admin:access`
- `ADMIN_AUTH_CLIENT_ID=<client-id-da-spa-admin>`
- `ADMIN_AUTH_SCOPES=openid profile email admin:access`
- `ADMIN_AUTH_CONNECT_SRC=https://tenant.example.auth0.com`
- `CF_API_TOKEN=<token-cloudflare>`
- `CF_ZONE_ID=<zone-id-cloudflare>`
- `CF_RECORD_NAME=admin.seu-dominio.com`
- `ADMIN_WEB_ENABLE_MUTATIONS=false` (iniciar em modo seguro)

## Passo 2 - Gerar Basic Auth
Opcoes:
1. Usar `htpasswd` local (Apache utils) para gerar `ops/admin-gateway/.htpasswd`.
2. Gerar hash em container temporario.

Exemplo (container):
```powershell
docker run --rm httpd:2.4-alpine htpasswd -nbB admin "troque-esta-senha"
```

Salvar saida em:
- `ops/admin-gateway/.htpasswd`

## Passo 3 - Instalar certificado de origem
Copiar certificados para:
- `ops/admin-gateway/certs/origin.crt`
- `ops/admin-gateway/certs/origin.key`

Cloudflare SSL/TLS:
- mode: `Full (strict)`.

## Passo 4 - Subir stack
```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Verificar containers:
```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

## Passo 5 - Validacao inicial
1. UI sem credencial deve responder `401`.
2. `GET /api/v2/health` deve responder `200` sem Basic Auth.
3. `GET /api/v2/internal/admin/*` deve responder `403`.
4. `GET /admin-api/*` com Basic Auth deve funcionar.
5. Se `ADMIN_AUTH_ENABLED=true`, login pelo Auth0 deve concluir e `/admin-api/*` deve enviar `X-Admin-Authorization`, que o gateway repassa para a API como `Authorization: Bearer`.

Smoke script:
```powershell
$env:GATEWAY_BASE_URL="https://localhost"
$env:GATEWAY_BASIC_AUTH_USER="admin"
$env:GATEWAY_BASIC_AUTH_PASSWORD="troque-esta-senha"
$env:GATEWAY_INSECURE_TLS="true"
npm run gateway:smoke
```

## Passo 6 - DDNS Cloudflare
Servico `ddns` no compose atualiza automaticamente o registro:
- `CF_RECORD_NAME` via `CF_API_TOKEN` no `CF_ZONE_ID`.

Recomendacoes:
- token com permissao minima de DNS edit no zone alvo;
- manter proxy Cloudflare ativo (orange cloud).

## Passo 7 - Rollout de mutacoes
1. Validar stack com `ADMIN_WEB_ENABLE_MUTATIONS=false`.
2. Quando aprovado, alterar para `true` em `.env.prod`.
3. Recriar apenas gateway:
```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --no-deps --build admin-gateway
```

## Passo 8 - Rollout Auth0 Admin
1. Configurar no Auth0 uma SPA para o painel administrativo e uma API com RBAC.
2. Liberar callback `https://<PUBLIC_DOMAIN>/login` e web origin `https://<PUBLIC_DOMAIN>`.
3. Atribuir a permissao `admin:access` aos operadores.
4. Ajustar `ADMIN_AUTH_*` no `.env.prod` e trocar `ADMIN_AUTH_ENABLED=true`.
5. Recriar `api` e `admin-gateway`:
```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --no-deps --build api admin-gateway
```

## Rollback rapido
1. Voltar `ADMIN_WEB_ENABLE_MUTATIONS=false`.
2. Se o problema for Auth0 Admin, voltar `ADMIN_AUTH_ENABLED=false`.
3. Recriar `api` e `admin-gateway`:
```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --no-deps --build api admin-gateway
```
4. Se necessario rollback completo:
```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

## Observabilidade e alertas
- Prometheus faz scrape interno em `api:3001/api/v2/metrics`.
- Alertas definidos em `ops/monitoring/alert.rules.yml`:
  - 5xx elevado em rotas publicas de licensing;
  - latencia p95 alta em rotas publicas de licensing;
  - pico de `block/cancel` no backoffice.

## Checklist de seguranca minima
- Nao usar `dev-internal-admin-key` em producao.
- Trocar todos os valores `change-me-*` de segredos antes de subir a API.
- Nao manter `postgres` como senha do banco em producao.
- Manter `CORS_ALLOWED_ORIGINS` restrito ao dominio HTTPS publicado.
- Nao versionar `.env.prod`, `.htpasswd`, certificados.
- Rotacionar `INTERNAL_ADMIN_API_KEYS` trimestralmente.
- Revisar WAF/rate-limit da Cloudflare para `/api/v2/license*` e `/api/v2/licenses*`.
