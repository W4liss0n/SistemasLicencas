# Rewrite v2 - Arquitetura de Dados

## Diretriz
Banco desenhado para runtime de licencas com:
- consistencia transacional
- rastreabilidade
- suporte a idempotencia
- isolamento por programa

## Decisoes chave
1. Prisma sobre PostgreSQL para manter schema tipado e migrations auditaveis.
2. Tabela dedicada de idempotencia para mutacoes com replay deterministico.
3. Credenciais de cliente persistidas no banco, sem segredo hardcoded em runtime.
4. Auditoria com `audit_logs` para eventos de transferencia e desativacao.

## Integridade e concorrencia
- Constraint unica em idempotencia (`idempotency_key`, `endpoint`).
- Constraint unica em credencial por programa (`program_id`, `identifier`).
- Em conflitos de concorrencia, API responde com erro canonico de conflito.

## Expiracao e limpeza
- `idempotency_keys.expires_at` define janela de replay.
- TTL logico configurado por `IDEMPOTENCY_TTL_HOURS`.

## Evolucao futura esperada
- rotacao de hash version (`hash_version`) para algoritmos novos.
- jobs de limpeza de chaves idempotentes expiradas.
- ampliacao de trilha de auditoria com outbox para integracoes externas.
