# Rewrite v2 - Estado Atual de Validacao

## Objetivo
Consolidar o runtime publico v2 com robustez operacional e compatibilidade semantica com o legado.

## Entregas tecnicas consolidadas
- Oracle local automatizado para executar legado e v2 lado a lado.
- Runner de compatibilidade cobrindo cenarios de sucesso e erro.
- Credencial fixa removida de autenticacao.
- Credencial persistida em `client_credentials` com hash forte.
- Baseline de observabilidade com traces e metricas.
- Lint de documentacao para bloquear drift para referencias legadas fora de paginas de compatibilidade.

## Cenarios de compatibilidade executados
- authenticate_invalid_credentials
- authenticate_success
- validate_bad_payload
- validate_unknown_license
- validate_success
- activate_success
- heartbeat_success
- transfer_success
- transfer_idempotency_replay
- transfer_limit_exceeded
- deactivate_success

## Criterio de compatibilidade
Compatibilidade semantica:
- divergencias aceitas: formato textual de mensagem e pequenas diferencas de status/code documentadas.
- divergencias nao aceitas: sucesso/erro invertido, quebra de autorizacao, quebra de headers obrigatorios.

## Comandos operacionais
```bash
cd SistemaLicencas
npm run oracle:local:up
npm run oracle:local:run
npm run oracle:local:down
# ou fluxo unico
npm run test:legacy:local
```

## Artefato de saida
- `docs/rewrite-v2/compatibility-matrix.generated.md`
