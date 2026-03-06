# Arquitetura - Visao Geral

## Contexto
O projeto `sistema-licencas-v2` e um modular monolith em NestJS + Fastify.
O foco e runtime publico de licencas com isolamento por programa, idempotencia e rastreabilidade.

## Stack principal
- Runtime: NestJS 11 + Fastify
- Linguagem: TypeScript
- Banco: PostgreSQL via Prisma
- Cache/infra auxiliar: Redis
- Log: nestjs-pino
- Observabilidade: OpenTelemetry + Prometheus (`prom-client`)

## Stack da interface web interna (fase 11)
- App: `apps/admin-web`
- UI: React 19 + MUI 7
- Build/dev server: Vite 7
- Estado servidor: TanStack Query v5
- Formularios: React Hook Form + Zod
- Testes: Vitest + Testing Library + MSW + Playwright

## Modulos de aplicacao
- `license-runtime`: endpoints publicos de autenticacao e licencas.
- `health`: readiness basico de dependencias.
- `metrics`: exposicao de metricas quando habilitado.
- `infra/prisma` e `infra/redis`: adaptadores de infraestrutura.

## Fronteiras de dados
- Programa, plano, assinatura e licenca vivem no Postgres.
- Idempotencia persistente em `idempotency_keys`.
- Credenciais de cliente em `client_credentials`.

## Regras transversais
- `ValidationPipe` global (whitelist + transform + forbidNonWhitelisted).
- `ProblemDetailsFilter` global para normalizacao de erros.
- `TraceIdInterceptor` e hook de request para correlacao.
- Rate limit global por minuto.

## Roteamento
Prefixo global configuravel por `API_PREFIX`, default `/api/v2`.

## Compatibilidade
O legado continua read-only. A compatibilidade e validada por oracle local automatizado.
