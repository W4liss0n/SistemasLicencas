# ADR-0003: REST API v2 Contract-First

## Status

Accepted

## Context

O sistema atende clientes externos (SDK) e internos (admin panel). Quebras de contrato impactam diretamente disponibilidade do cliente final.

## Decision Drivers

- Estabilidade de contrato publico
- Geração de clientes tipados
- Observabilidade e padronizacao de erros
- Compatibilidade retroativa planejada

## Considered Options

### Option A: REST sem contrato formal

- Pros: rapidez inicial
- Cons: alta chance de drift e inconsistencias

### Option B: GraphQL first

- Pros: flexibilidade de consulta
- Cons: complexidade desnecessaria para casos de comando de licensing

### Option C: REST + OpenAPI 3.1 (contract-first)

- Pros: previsibilidade, geracao de SDK, validação automatica em CI
- Cons: disciplina maior de governanca de schema

## Decision

Adotar **REST JSON com OpenAPI 3.1 contract-first** para API v2.

## Consequences

### Positive

- Contrato versionado com validação automatica.
- Menos regressao entre backend, SDK e admin.
- Erros padronizados com `application/problem+json`.

### Negative

- Ciclo de evolucao exige atualizacao coordenada de contrato.
- Mudancas nao planejadas em runtime deixam de ser aceitaveis.

## Implementation Notes

- Prefixo de versao: `/api/v2`.
- Idempotency-Key obrigatoria em mutacoes sensiveis.
- Cursor pagination para endpoints administrativos de lista.

