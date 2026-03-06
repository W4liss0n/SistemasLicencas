# Mini-spec - Identity Access MVP interno (Fase 9 P2)

Data: 2026-03-04

## Objetivo
Extrair para `identity-access` o fluxo de autenticacao de credenciais de cliente por programa, sem alterar contrato HTTP publico.

## Escopo
- Port interno `IdentityAccessPort`.
- Implementacoes:
  - `PrismaIdentityAccessService`
  - `InMemoryIdentityAccessService` (test)
- Selecao de estrategia dentro do modulo por `NODE_ENV`.
- Refator de `AuthenticationService` para fachada sobre `IDENTITY_ACCESS_PORT`.

## Contrato interno
Metodo:
1. `authenticateProgramClient({ programId, identifier, password })`

Retornos:
- sucesso com:
  - `accessToken`
  - `issuedAt`
  - `expiresAt`
- falha com codigos:
  - `invalid_credentials`
  - `unauthorized_program`

## Fluxo
1. Resolver programa autorizado (id/codigo, status ativo) no adapter Prisma.
2. Resolver credencial ativa por programa + identificador normalizado.
3. Verificar senha via hasher (`scrypt_v1` + pepper).
4. Atualizar `last_authenticated_at`.
5. Emitir token HMAC com mesmo formato e TTL atual.

## Criterios de aceite
1. `identity-access` deixa de ser placeholder e exporta `IDENTITY_ACCESS_PORT`.
2. `AuthenticationService` nao depende mais de adapters locais de credencial.
3. Sem mudanca de endpoint, DTO ou payload HTTP.
4. Testes cobrem sucesso, credencial invalida e programa nao autorizado.
