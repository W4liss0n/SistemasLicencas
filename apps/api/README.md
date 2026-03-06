# Sistema Licencas v2

Backend rewrite do sistema de licencas.

## Politica de isolamento do legado (obrigatoria)

1. O diretorio `../../legacy/sistema-licencas/` e read-only para este projeto.
2. Todo novo codigo do rewrite deve ficar em `apps/api/`.
3. Qualquer tentativa de alterar o legado deve falhar no CI da raiz via `npm run check:isolation`.

## Endpoints iniciais

- `GET /api/v2/health`
- `POST /api/v2/license/authenticate`
- `POST /api/v2/licenses/validate`
- `POST /api/v2/licenses/activate`
- `POST /api/v2/licenses/heartbeat`
- `POST /api/v2/licenses/transfer`
- `POST /api/v2/licenses/deactivate`

## Scripts principais

- `npm run start:dev`
- `npm run test`
- `npm run openapi:generate`
- `npm run openapi:validate`
- `npm run check:isolation`
- `npm run prisma:migrate:deploy`
- `npm run prisma:seed`

## Variaveis de ambiente

Copie `.env.example` para `.env` e ajuste os valores.

## Guardrails

- CI valida isolamento do legado, tipagem, testes e contrato OpenAPI.
- Erros seguem `application/problem+json` com `trace_id`.
- `X-Program-Id` obrigatorio no runtime publico de licensing.
- `Idempotency-Key` obrigatorio em mutacoes (`activate`, `transfer`, `deactivate`).

## Documentos

- Índice operacional v2: `../../docs/rewrite-v2/README.md`
- Progresso e proximos passos: `../../docs/rewrite-v2/progresso-v2-e-proximos-passos.md`
- Compatibilidade v1 vs v2: `../../docs/rewrite-v2/compatibility-matrix.md`
