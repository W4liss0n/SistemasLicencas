# Rollout - License Engine Strategy (nao-test)

Data de publicacao: 2026-03-04

## Objetivo
Padronizar rollout gradual da estrategia do `LicenseEnginePort` em ambientes nao-test, usando a variavel:

- `LICENSE_ENGINE_STRATEGY=auto|fake|prisma`

## Regras de seguranca
- `NODE_ENV=production` com `LICENSE_ENGINE_STRATEGY=fake` e **invalidado no boot** por validacao de configuracao.
- Em `production`, usar apenas:
  - `auto` (resolve para `prisma`)
  - `prisma`

## Resolucao de estrategia
- `auto`:
  - `test` -> `fake`
  - `development`/`staging`/`production` -> `prisma`
- `fake`: permitido somente fora de `production`
- `prisma`: forca Prisma em qualquer ambiente

## Plano de rollout gradual
1. **Staging - baseline**
- Configurar `LICENSE_ENGINE_STRATEGY=auto`
- Confirmar boot sem erro de env
- Executar smoke dos endpoints de licensing:
  - `POST /authenticate`
  - `POST /validate`
  - `POST /activate`
  - `POST /heartbeat`
  - `POST /transfer`
  - `POST /deactivate`

2. **Staging - pin de estrategia (opcional)**
- Configurar `LICENSE_ENGINE_STRATEGY=prisma`
- Repetir smoke e comparar semantica de erros
- Confirmar ausencia de regressao no contrato HTTP

3. **Production**
- Preferir `LICENSE_ENGINE_STRATEGY=auto`
- Alternativa controlada: `LICENSE_ENGINE_STRATEGY=prisma`
- Nao usar `fake` (bloqueado por politica)

## Validacao obrigatoria antes de promover
Executar no runtime v2:

```bash
npm run typecheck
npm run test
npm run test:contract:fake
npm run test:contract:prisma
npm run docs:lint
```

## Rollback operacional
Como `fake` e proibido em `production`, rollback de incidente deve ser:
1. Reverter para versao anterior conhecida do servico.
2. Manter `LICENSE_ENGINE_STRATEGY=auto` ou `prisma` (nunca `fake`).
3. Revalidar health e endpoints criticos de licensing.

## Registro de evidencia
Registrar por rollout:
- `timestamp`
- `ambiente`
- `commit/release`
- `LICENSE_ENGINE_STRATEGY` aplicado
- resultado do smoke
- resultado dos testes de contrato
- acao de rollback (se houver)

Template rapido:

```md
- Timestamp:
- Ambiente:
- Release:
- Estrategia:
- Smoke licensing:
- Contrato fake/prisma:
- Observacoes:
```
