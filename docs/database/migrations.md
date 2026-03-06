# Migrations (v2)

## Convencao
As migrations vivem em `apps/api/prisma/migrations` e sao aplicadas por `prisma migrate deploy`.

## Historico atual
### `0001_init`
Cria baseline do schema v2:
- dominios de cliente/plano/programa/assinatura/licenca
- estruturas de fingerprint, auditoria e idempotencia
- indices principais para fluxo de runtime

### `0002_client_credentials`
Adiciona persistencia de credenciais de cliente:
- tabela `client_credentials`
- FK para `programs`
- unique `(program_id, identifier)`
- colunas de hash/salt/versionamento

## Fluxo operacional
```bash
cd SistemaLicencas
npm run prisma:migrate:deploy
npm run prisma:seed
```

## Boas praticas
- Nunca editar migration aplicada.
- Mudancas de schema sempre via nova migration.
- Sincronizar docs com migration + seed no mesmo PR.
