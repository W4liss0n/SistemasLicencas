# Deployment - Checklist Operacional OpenTelemetry (Nao-Dev)

Data de publicacao: 2026-03-04

## Objetivo
Padronizar habilitacao e validacao de traces OpenTelemetry no runtime `sistema-licencas-v2` em ambientes nao-dev (`staging` e `production`), com evidencia operacional auditavel.

## Escopo
- Ambientes: `staging` e `production`.
- Sinal coberto neste checklist: traces OTLP HTTP.
- Sem lock-in de vendor: collector/backends podem variar (OTLP padrao).

## Pre-requisitos
Antes do deploy, garantir:
1. Collector OTLP HTTP disponivel e roteando traces.
2. Conectividade de rede entre a API e o collector (DNS, rota, porta).
3. TLS/certificados validos quando endpoint for HTTPS.
4. Header/token de autenticacao provisionado quando exigido pelo collector/proxy.
5. Time de operacao com acesso ao backend de observabilidade para consultar traces.

## Matriz de configuracao

### Variaveis minimas
- `OTEL_ENABLED=true`
- `OTEL_SERVICE_NAME=<servico>-<ambiente>`

Exemplo recomendado:
- `OTEL_SERVICE_NAME=sistema-licencas-v2-staging`
- `OTEL_SERVICE_NAME=sistema-licencas-v2-production`

### Endpoint geral (recomendado)
- `OTEL_EXPORTER_OTLP_ENDPOINT=<base-url>`

Exemplo:
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.observability.svc.cluster.local:4318`

Observacao:
- em OpenTelemetry JS HTTP exporter, o endpoint geral pode usar base URL; o path de traces e resolvido para `/v1/traces`.

### Endpoint especifico de traces (alternativa)
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=<url-completa>/v1/traces`

Exemplo:
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://otel-gateway.interno/v1/traces`

### Regra de precedencia
Quando ambos estiverem definidos:
1. `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` prevalece para traces.
2. `OTEL_EXPORTER_OTLP_ENDPOINT` fica como fallback geral para sinais sem endpoint especifico.

## Checklist pre-deploy
1. [ ] Confirmar que `OTEL_ENABLED=true` no ambiente alvo.
2. [ ] Confirmar `OTEL_SERVICE_NAME` contendo sufixo de ambiente (`-staging` ou `-production`).
3. [ ] Validar escolha de endpoint:
   - geral em `OTEL_EXPORTER_OTLP_ENDPOINT`, ou
   - especifico em `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` com `/v1/traces`.
4. [ ] Validar segredo/header exigido pelo collector (quando aplicavel).
5. [ ] Executar teste de conectividade a partir do ambiente de execucao da API.

Comando de exemplo (ajustar host/porta):
```bash
TARGET_OTLP_TRACES_ENDPOINT="${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:-$OTEL_EXPORTER_OTLP_ENDPOINT/v1/traces}"
curl -i -X POST "$TARGET_OTLP_TRACES_ENDPOINT" \
  -H "Content-Type: application/json" \
  --max-time 5
```

Resultado esperado:
- sem erro de DNS/timeout/TLS no caminho de rede.

## Checklist pos-deploy
1. [ ] Aplicacao iniciou sem erro operacional relacionado a OTel.
2. [ ] Gerar trafego sintetico em endpoint publico (ex.: `GET /api/v2/health` e `POST /api/v2/licenses/validate`).
3. [ ] Confirmar chegada de traces no backend observability para `service.name` do ambiente.
4. [ ] Confirmar amostra com atributos de request (metodo/rota/status).
5. [ ] Registrar evidencia da validacao.

## Procedimento de validacao com evidencia
Registrar em ticket/runbook operacional:
1. `timestamp` UTC da validacao.
2. `ambiente` (`staging` ou `production`).
3. `service.name` efetivo.
4. endpoint OTLP utilizado (mascarando segredos).
5. identificador de trace amostra (`trace_id` ou link permanente no backend).
6. operador responsavel e resultado (`aprovado` ou `reprovado`).

Template minimo:
```txt
timestamp_utc: 2026-03-04T15:30:00Z
ambiente: staging
service_name: sistema-licencas-v2-staging
otlp_endpoint: https://otel-gateway.interno (via OTEL_EXPORTER_OTLP_ENDPOINT)
trace_sample: trace_id=abc123...
resultado: aprovado
responsavel: <nome>
```

## Troubleshooting rapido
Se traces nao chegarem:
1. Verificar `OTEL_ENABLED` e variaveis OTLP no ambiente efetivo do processo.
2. Verificar precedencia: endpoint por sinal pode estar sobrescrevendo endpoint geral.
3. Testar DNS/TCP/TLS ate o collector.
4. Verificar bloqueios de proxy/firewall/egress policy.
5. Revisar autenticacao (header/token) no gateway OTLP.
6. Revisar logs da API e do collector no mesmo intervalo de tempo.

## Rollback operacional
Se houver degradacao operacional associada a OTel:
1. Definir `OTEL_ENABLED=false`.
2. Fazer redeploy do servico.
3. Confirmar startup sem erro.
4. Reexecutar smoke test funcional (`/health`, endpoints de licensing criticos).
5. Registrar incidente e causa preliminar para replanejar habilitacao.

## Evidencia desta entrega (documentacao)
- Checklist publicado em: `docs/deployment/opentelemetry-checklist.md` (2026-03-04).
- Roadmap atualizado para refletir conclusao de fase P1 com evidencia documental.
