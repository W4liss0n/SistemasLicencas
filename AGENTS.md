# AGENTS

## Contexto do Projeto

- Estamos refazendo o sistema `sistema-licencas` em `sistema-licencas-v2`.
- A documentação de arquitetura e stack está em [README.md](docs/README.md).

## Diretrizes Obrigatórias para Agentes

- Sempre utilizar o Context7 para obter a documentação mais recente das bibliotecas utilizadas.

## Skills Prioritárias deste Repositório

Utilizar como shortlist padrão as seguintes skills instaladas:

- `concise-planning`: para quebrar tarefas, definir etapas e reduzir ambiguidade antes de implementar.
- `senior-architect`: para decisões de arquitetura, refactors estruturais, modularização e avaliação de trade-offs.
- `backend-dev-guidelines`: para implementação e manutenção do backend com consistência de padrões.
- `typescript-expert`: para tipagem, contratos, modelagem de tipos e melhorias de qualidade em TypeScript.
- `database-design`: para modelagem de dados, constraints, índices, migrations e decisões de persistência.
- `systematic-debugging`: para investigação de bugs, incidentes e diagnóstico de causa raiz.
- `lint-and-validate`: para validação final de alterações, lint, tipos e checks automáticos.
- `code-review-checklist`: para revisão final focada em regressão, segurança, testes e qualidade de entrega.

## Ordem Recomendada de Uso

- Planejamento: `concise-planning`
- Arquitetura e decisões maiores: `senior-architect`
- Implementação backend: `backend-dev-guidelines` + `typescript-expert`
- Banco e migrations: `database-design`
- Debug e investigação: `systematic-debugging`
- Fechamento e revisão: `lint-and-validate` + `code-review-checklist`
