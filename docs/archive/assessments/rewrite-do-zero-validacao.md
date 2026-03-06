# Validacao Tecnica Para Rewrite Do Zero

**Data da avaliacao:** 4 de marco de 2026  
**Escopo:** backend, frontend web, cliente Python e postura de seguranca

## Objetivo

Documentar a validacao tecnica para refazer o sistema de licencas do zero, mantendo a ideia principal (validacao, ativacao, heartbeat, transferencia, modo offline, limite por dispositivo/plano e auditoria).

## Metodologia

- Revisao arquitetural: `architecture` + `architect-review`
- Auditoria de dependencias: `dependency-management-deps-audit` + `dependency-upgrade`
- Auditoria de seguranca aplicada ao codigo e configuracoes: `security-audit`
- Comandos executados:
  - `npm audit --package-lock-only --json` (backend e web)
  - `npm outdated --json` (backend e web)
  - `python -m pip_audit -r test-program/requirements.txt`

## Achados Prioritarios

1. **Critico**: chave privada RSA exposta no workspace (`.env` e `keys/private.pem`).
2. **Alto**: risco de SQL injection em insercoes montadas por string no controller de planos.
3. **Alto**: vulnerabilidades de dependencias no backend e frontend.
4. **Alto**: segredos com fallback default hardcoded em servicos de autenticacao/licenca.
5. **Medio**: revisao de licenciamento de dependencias Python (especialmente `psycopg2-binary`).

## Resultado Dos Scans

### Backend (Node)

- `npm audit`: **4 vulnerabilidades**
  - `2 high`
  - `2 moderate`
- Principais pacotes afetados (transitivos): `jws`, `minimatch`, `body-parser`, `qs`

### Frontend (React/Vite)

- `npm audit`: **8 vulnerabilidades**
  - `4 high`
  - `4 moderate`
- Pacotes afetados (diretos e transitivos): `axios`, `react-router/react-router-dom`, `rollup`, `vite`, `ajv`, `js-yaml`, `minimatch`

### Python

- `pip-audit` em `test-program/requirements.txt`: **nenhuma vulnerabilidade conhecida**

## Recomendacao Final Por Ponto

### 1) Engine de licencas pronta

- **Recomendacao principal:** `Keygen`
- **Alternativa:** `Cryptolens`
- **Racional:** cobre fluxo de licenciamento com binding de dispositivo e operacao offline com menos codigo proprietario.

### 2) Backend (camada de negocio e integracao)

- **Recomendacao principal:** `NestJS + Fastify Adapter + Prisma + jose + BullMQ`
- **Alternativa:** `Fastify + Drizzle`
- **Racional:** modularidade forte, seguranca mais consistente, melhor base para evolucao.

### 3) Observabilidade

- **Recomendacao:** `OpenTelemetry + prom-client + pino`
- **Racional:** rastreabilidade, metricas e logs estruturados com baixo overhead.

### 4) Painel admin

- **Recomendacao:** `react-admin + TanStack Query + MUI X Data Grid + Orval`
- **Racional:** acelera CRUD/admin, reduz boilerplate e melhora padronizacao.

### 5) SDK Python cliente

- **Recomendacao:** `HTTPX + Tenacity + Pydantic + PyJWT + cryptography + platformdirs + keyring + py-machineid`
- **Racional:** robustez de rede, tipagem/validacao forte, criptografia e persistencia segura.

## Decisao Arquitetural Inicial (ADR Preliminar)

- **Decisao:** iniciar com **monolito modular** (nao microservices).
- **Motivo:** menor custo de complexidade para reescrita, entrega mais rapida e evolucao segura.
- **Revisitar quando:** volume/escala exigir deploy e escalabilidade independentes por dominio.

## Riscos E Mitigacoes

- **Risco:** continuidade com segredos expostos.
  - **Mitigacao:** rotacao imediata de chaves e credenciais; remover segredos do workspace/versionamento.
- **Risco:** SQL injection.
  - **Mitigacao:** remover SQL string-built; usar queries parametrizadas/ORM.
- **Risco:** regressao funcional no rewrite.
  - **Mitigacao:** testes de contrato para `validate/activate/heartbeat/transfer/deactivate`.
- **Risco:** vulnerabilidades recorrentes em deps.
  - **Mitigacao:** CI com `audit`, Renovate/Dependabot e policy de patch regular.

## Plano De Execucao Recomendado

1. **Fase 0 (Seguranca imediata)**
   - Rotacionar RSA/JWT/DB/Redis.
   - Corrigir pontos de SQL inseguro.
   - Aplicar updates de seguranca em dependencias atuais.
2. **Fase 1 (Arquitetura base)**
   - Estruturar novo backend modular, observabilidade e auth.
   - Publicar OpenAPI e gerar clientes tipados.
3. **Fase 2 (Nucleo de licencas)**
   - Implementar fluxo principal com testes de contrato.
   - Reimplementar modo offline e regras de dispositivo/plano.
4. **Fase 3 (Painel e migracao)**
   - Recriar admin panel.
   - Planejar migracao de dados e cutover gradual.

## Conclusao

A direcao recomendada (engine especializada + backend modular moderno + observabilidade + SDK Python robusto) foi validada tecnicamente e e consistente com o objetivo de refazer do zero mantendo o nucleo do negocio.
