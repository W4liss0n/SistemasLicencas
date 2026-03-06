# ADR-0001: Modular Monolith First

## Status

Accepted

## Context

O sistema atual apresenta problemas de seguranca, consistencia de regras e acoplamento tecnico. O rewrite precisa entregar rapidamente um core confiavel sem multiplicar a complexidade operacional.

## Decision Drivers

- Time-to-market do rewrite
- Simplicidade de operacao
- Necessidade de modularidade por dominio
- Possibilidade de evolucao futura para servicos separados

## Considered Options

### Option A: Microservicos desde o inicio

- Pros: escalabilidade isolada por dominio, independencia de deploy
- Cons: custo operacional alto, latencia de rede, maior superficie de falha

### Option B: Modular Monolith

- Pros: baixa complexidade inicial, fronteiras de dominio explicitas, deploy unico
- Cons: risco de acoplamento interno se governanca falhar

## Decision

Adotar **Modular Monolith** na fase inicial do rewrite, com bounded contexts e contratos internos explicitos.

## Consequences

### Positive

- Entrega mais rapida do nucleo de negocio.
- Menor custo de infraestrutura e observabilidade no ciclo inicial.
- Evolucao controlada para extração de servicos quando houver evidencia de necessidade.

### Negative

- Exige disciplina arquitetural para evitar dependencia circular.
- Escalabilidade independente por dominio nao existe no curto prazo.

## Review Trigger

Reavaliar em 2 condicoes:

1. dominio com p95 de latencia acima da meta por 3 releases seguidos;
2. necessidade comprovada de deploy independente em pelo menos 2 contextos.

