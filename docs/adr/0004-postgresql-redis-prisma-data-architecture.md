# ADR-0004: PostgreSQL + Redis + Prisma Data Architecture

## Status

Accepted

## Context

O dominio exige consistencia transacional (assinaturas/licencas), auditoria forte e baixa latencia para validacao e rate limiting.

## Decision Drivers

- ACID para operacoes criticas
- Performance em leituras quentes
- Simplicidade operacional
- Migrations auditaveis e versionadas

## Considered Options

### Option A: NoSQL como primario

- Pros: flexibilidade de schema
- Cons: modelagem mais complexa para invariantes transacionais

### Option B: PostgreSQL only

- Pros: stack reduzida
- Cons: perda de performance para contadores/TTL/rate limiting

### Option C: PostgreSQL + Redis + Prisma

- Pros: melhor equilibrio entre consistencia e latencia
- Cons: dois stores para operar

## Decision

Adotar **PostgreSQL 16** como store principal, **Redis 7** para estado volatil/performance, e **Prisma** para acesso e migrations.

## Consequences

### Positive

- Invariantes de negocio ficam no banco relacional com integridade forte.
- Rate limiting e nonces com baixa latencia em Redis.
- Evolucao de schema com trilha clara.

### Negative

- Maior cuidado com coerencia entre dados persistentes e estado em cache.
- Exige rotina de backup e restore madura para PostgreSQL.

## Implementation Notes

- Outbox pattern no PostgreSQL para eventos confiaveis.
- Particionamento mensal de tabelas de eventos/auditoria.
- Politica de retençao para historicos volumosos.

