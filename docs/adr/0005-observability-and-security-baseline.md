# ADR-0005: Observability and Security Baseline

## Status

Accepted

## Context

O estado atual apontou segredos expostos, riscos de injecao e baixa rastreabilidade de incidentes. O rewrite precisa nascer com baseline de seguranca e observabilidade.

## Decision Drivers

- Reduzir MTTR em incidentes
- Evidencia tecnica para auditoria
- Bloquear recorrencia de falhas de seguranca basicas
- Rastrear chamadas ponta a ponta

## Considered Options

### Option A: Logs simples e monitoracao minima

- Pros: baixo esforco inicial
- Cons: baixa capacidade de diagnostico e resposta

### Option B: Stack completa de observabilidade e hardening no dia 1

- Pros: rastreabilidade e seguranca melhores desde o inicio
- Cons: maior investimento inicial

## Decision

Adotar baseline obrigatoria:

- **OpenTelemetry** para traces
- **prom-client** para metricas
- **pino** para logs estruturados
- Secrets em secret manager e rotacao formal
- SAST + dependency audit + policy gate em CI

## Consequences

### Positive

- Investigacao mais rapida de incidentes.
- Melhora da confiabilidade operacional.
- Menor chance de reintroduzir vulnerabilidades basicas.

### Negative

- Custo de instrumentacao inicial maior.
- Necessidade de disciplina na governanca de alertas e dashboards.

## Implementation Notes

- Todos os endpoints de licenca devem emitir `trace_id`.
- Alertas minimos: erro 5xx, aumento de `fingerprint_mismatch`, latencia p95.
- Proibir deploy sem verificacao de secret scanning e audit de dependencias.

