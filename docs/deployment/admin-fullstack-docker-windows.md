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
- `JWT_SECRET=<segredo-forte>`
- `INTERNAL_ADMIN_API_KEYS=<chave-interna-forte>`
- `ADMIN_INTERNAL_API_KEY=<mesma-chave-interna-forte>`
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

## Rollback rapido
1. Voltar `ADMIN_WEB_ENABLE_MUTATIONS=false`.
2. Recriar `admin-gateway`:
```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --no-deps --build admin-gateway
```
3. Se necessario rollback completo:
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
- Nao versionar `.env.prod`, `.htpasswd`, certificados.
- Rotacionar `INTERNAL_ADMIN_API_KEYS` trimestralmente.
- Revisar WAF/rate-limit da Cloudflare para `/api/v2/license*` e `/api/v2/licenses*`.
