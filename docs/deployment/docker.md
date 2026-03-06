# Deployment - Docker

## Arquivo principal
`/docker-compose.yml`

## Servicos
- `postgres` (porta host `5433`)
- `redis` (porta host `6380`)
- `api` (porta host `3001`)

## Subir stack local
```bash
cd SistemaLicencas
docker compose up -d --build
```

## Logs
```bash
docker compose logs -f api
```

## Encerrar stack
```bash
docker compose down
```

## Pre-requisito para oracle local
O oracle local depende de Docker daemon ativo.

Cheque antes de executar:
```bash
docker info
```

Se o comando acima falhar, inicie o Docker Desktop/daemon e rode novamente.

## Oracle local de compatibilidade (legado + v2)
```bash
cd SistemaLicencas
npm run oracle:local:up
npm run oracle:local:run
npm run oracle:local:down
```

## Erro de preflight (Docker indisponivel)
Quando Docker nao estiver ativo, `npm run test:legacy:local` falha cedo com mensagem guiada:
1. Docker daemon is unavailable.
2. Start Docker Desktop (or your Docker daemon).
3. Validate Docker access with `docker info`.
4. Re-run `npm run test:legacy:local`.

## Portas do oracle
- legado api: `3000`
- v2 api: `3001`
- legado postgres: `55432`
- v2 postgres: `55433`
- legado redis: `56379`
- v2 redis: `56380`
