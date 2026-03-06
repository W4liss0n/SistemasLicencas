# API Interna - Admin Backoffice

## Escopo
Este modulo cobre operacoes internas de provisionamento e gestao manual de licencas,
bem como administracao de usuarios finais para o fluxo de auth OIDC.
Nao faz parte do contrato publico consumido por clientes finais.

## Prefixo
As rotas internas ficam sob `POST/GET/PATCH /api/v2/internal/admin/*`.

### Licensing admin
- `POST /api/v2/internal/admin/licenses`
- `POST /api/v2/internal/admin/licenses/:licenseKey/renew`
- `POST /api/v2/internal/admin/licenses/:licenseKey/block`
- `POST /api/v2/internal/admin/licenses/:licenseKey/unblock`
- `POST /api/v2/internal/admin/licenses/:licenseKey/cancel`
- `GET /api/v2/internal/admin/licenses/:licenseKey`
- `GET /api/v2/internal/admin/operational-summary`

### Admin de usuario final
- `POST /api/v2/internal/admin/users`
- `PATCH /api/v2/internal/admin/users/:id`
- `POST /api/v2/internal/admin/users/:id/block`
- `POST /api/v2/internal/admin/users/:id/unblock`

## Headers obrigatorios
- Todas as rotas internas: `X-Internal-Api-Key`.
- Mutacoes de licensing (`POST /licenses*`, `renew`, `block`, `unblock`, `cancel`): `Idempotency-Key`.
- Rotas de usuario final nao exigem `Idempotency-Key` nesta fase.

## Regras centrais
- Provisionamento valida programa ativo e autorizacao de plano por programa.
- Renovacao atualiza `subscription.end_at` e reativa assinatura quando aplicavel.
- Bloqueio/desbloqueio altera status da licenca (com regra de elegibilidade no desbloqueio).
- Cancelamento marca licenca como `inactive` e assinatura como `cancelled`.
- Toda mutacao administrativa de licensing registra auditoria em `audit_logs`.
- Bloqueio de usuario final revoga sessoes ativas associadas ao usuario.

## Contrato de erro
Erros retornam `application/problem+json` com:
- `type`, `title`, `status`, `code`, `detail`, `instance`, `trace_id`
