# Arquitetura - Fluxo de Dados

## 1) Authenticate
```mermaid
sequenceDiagram
    participant Client
    participant API as v2 API
    participant DB as PostgreSQL

    Client->>API: POST /api/v2/license/authenticate
    API->>DB: resolve Program + ClientCredential
    API->>API: verify scrypt hash + pepper
    API-->>Client: 200 access_token
```

## 2) Validate
```mermaid
sequenceDiagram
    participant Client
    participant API as v2 API
    participant DB as PostgreSQL

    Client->>API: POST /api/v2/licenses/validate
    API->>DB: load license/subscription/plan/program
    API->>API: normalize fingerprint + hash
    API->>DB: upsert/read device fingerprint + device link
    API-->>Client: 200 valid + license_info + offline_token
```

## 3) Activate (idempotente)
```mermaid
sequenceDiagram
    participant Client
    participant API as v2 API
    participant DB as PostgreSQL

    Client->>API: POST /activate + Idempotency-Key
    API->>DB: check/create idempotency record
    alt replay
      API-->>Client: cached response
    else first execution
      API->>DB: enforce device limit + register/touch device
      API->>DB: persist response in idempotency record
      API-->>Client: 200 success
    end
```

## 4) Transfer e Deactivate
- `transfer` desativa dispositivos ativos anteriores e ativa o novo fingerprint.
- `deactivate` desativa o dispositivo correspondente ao fingerprint informado.

## 5) Erros e correlacao
- Falhas mapeadas para `problem+json`.
- `trace_id` e `x-request-id` sao usados em logs, resposta e metricas.

## 6) Observabilidade
- Traces: OpenTelemetry (startup antes do bootstrap da app).
- Metricas: contadores/histograma HTTP + falhas de runtime + replay de idempotencia.
