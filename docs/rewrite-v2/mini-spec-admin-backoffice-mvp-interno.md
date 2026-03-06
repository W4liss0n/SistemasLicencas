# Mini-spec - Admin Backoffice MVP interno (Fase 9 P2)

Data: 2026-03-04

## Objetivo
Remover placeholder de `admin-backoffice` com capacidade minima de leitura operacional interna, sem expor endpoint novo.

## Escopo
- Port interno `AdminBackofficePort`.
- Implementacao Prisma `PrismaAdminBackofficeService`.
- Metodo de resumo operacional agregado para uso interno.

## Contrato interno
Metodo:
1. `getOperationalSummary({ windowDays? })`

Retorno:
- `generatedAt`
- `windowDays`
- blocos agregados:
  - `totals` (clientes, assinaturas ativas, licencas, dispositivos ativos)
  - `recent` (falhas de validacao, eventos criticos, transferencias, desativacoes)

## Criterios de aceite
1. `admin-backoffice` deixa de ser placeholder e exporta `ADMIN_BACKOFFICE_PORT`.
2. Nao ha controller/endpoint novo nesta fase.
3. Testes unitarios cobrem cenarios vazios e mistos.
