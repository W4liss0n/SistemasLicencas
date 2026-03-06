# ADR-0002: Licensing Engine Adapter (Keygen First)

## Status

Accepted

## Context

A validacao tecnica identificou alto risco em manter toda a logica de licensing proprietaria sem camada de protecao. O rewrite precisa reduzir risco de implementacao e manter flexibilidade de provedor.

## Decision Drivers

- Reducao de risco no fluxo de licenciamento
- Tempo de entrega
- Suporte offline e device binding
- Evitar lock-in rigido de fornecedor

## Considered Options

### Option A: Build 100% in-house

- Pros: controle total
- Cons: maior risco e prazo, maior carga de manutencao de seguranca

### Option B: Keygen direto sem adapter

- Pros: entrega rapida
- Cons: lock-in forte e alto acoplamento do dominio ao fornecedor

### Option C: Adapter de engine com Keygen primario

- Pros: troca de fornecedor viavel, isolamento de mudancas, entrega rapida
- Cons: camada extra para manter

## Decision

Adotar **adapter de licensing engine** no modulo `license-runtime`, com **Keygen como provedor primario** e opcao de fallback para `Cryptolens`.

## Consequences

### Positive

- Reduz risco de atraso no core.
- Preserva independencia arquitetural para troca de provedor.
- Facilita testes por mock/fake de adapter.

### Negative

- Requer monitoramento de SLA externo.
- Introduz latencia adicional em chamadas remotas se nao houver cache adequado.

## Implementation Notes

- Interface canonica: `LicenseEnginePort`.
- Politica de timeout, retry e circuit breaker.
- Fallback controlado por feature flag.

