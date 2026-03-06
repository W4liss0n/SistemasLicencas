# Sistema Licencas

Workspace canonico do rewrite `sistema-licencas-v2`.

## Estrutura

- `apps/api`: backend NestJS + Prisma.
- `apps/admin-web`: interface interna React + Vite.
- `legacy/sistema-licencas`: legado read-only para oracle de compatibilidade.
- `docs`: documentacao tecnica e operacional.
- `ops`: artefatos de deploy e observabilidade.
- `scripts`: automacoes cross-cutting de dev, gateway e compatibilidade.

## Comandos principais

```bash
npm install
npm run api:dev
npm run api:test
npm run api:typecheck
npm run api:openapi:generate
npm run api:openapi:validate
npm run admin-web:dev
npm run admin-web:test
npm run compat:legacy:local
```

## Guardrails

1. `legacy/sistema-licencas/` e read-only.
2. Codigo novo fica em `apps/api/`, `apps/admin-web/`, `docs/`, `ops/` ou `scripts/`.
3. Logs e artefatos locais ficam fora da estrutura oficial (`.tmp/`, `.openapi/`, caches, `node_modules/`, `dist/`).

## Documentacao

- `docs/README.md`
- `docs/rewrite-v2/README.md`
- `docs/rewrite-v2/progresso-v2-e-proximos-passos.md`
- `docs/rewrite-v2/compatibility-matrix.md`