# AGENTS.md

## Objetivo deste arquivo

- Este arquivo define regras duráveis do repositório para agentes de código.
- Use o prompt da tarefa para objetivo, contexto imediato, restrições temporárias e definição de pronto específica.
- Não trate este arquivo como plano de tarefa.

## Visão rápida do projeto

- Aplicação web com separação clara entre frontend, backend, domínio e infraestrutura.
- O sistema pode incluir UI web, APIs, autenticação, persistência, integrações externas, filas, cache e storage.
- Estruture o código por contexto, responsabilidade e camada, evitando organização puramente técnica quando isso esconder o domínio.
- Arquitetura em uso: separação entre View/UI, ViewModel/Presenter quando aplicável, Application/Service, Domain, Core, Infrastructure e `src/app/` ou equivalente como composition root.
- A fonte única da versão pública da aplicação deve ser explícita e centralizada em um único módulo/arquivo do repositório.

## Antes de implementar

- Faça a menor mudança coerente com a camada correta.
- Não invente comandos de setup, lint, testes, type-check, migração, build ou deploy.
- Ao tocar APIs, SDKs, bibliotecas externas ou comportamento incerto/atual, consulte nesta ordem:
  1. código e documentação do próprio repositório;
  2. documentação oficial do fornecedor;
  3. Context7.
- Não crie módulos genéricos ou soltos; organize por contexto, responsabilidade e camada.
- Evite `utils.py`, `helpers.py`, `common.py` e `misc.py`; extraia por contexto, responsabilidade e vocabulário do domínio.
- Não espalhe regras transversais importantes; centralize autenticação, autorização, validação, observabilidade, cache e acesso a dados em pontos previsíveis.

## Como descobrir comandos do projeto

- Procure primeiro em `README`, `Makefile`, `justfile`, `taskfile`, `package.json`, `pyproject.toml`, scripts internos, workflows de CI e documentação operacional.
- Quando houver vários caminhos, prefira o workflow já adotado pela CI.
- Se os comandos não existirem, explicite a lacuna e proponha o menor conjunto necessário; não invente um workflow fictício.

## Versionamento

- Use SemVer: `MAJOR.MINOR.PATCH`, salvo regra explícita diferente do repositório.
- Se o comportamento público do sistema mudou, a versão pública também deve ser revista conforme a política do projeto.
- A fonte única da versão pública deve ser lida pelos artefatos relevantes: frontend, backend, build, container, documentação pública e monitoramento, quando aplicável.
- Não misture a versão pública do sistema com versões de schema, formatos persistidos, contratos internos ou migrações.

## Arquitetura

- **View / UI**: apresentação, estado de tela local, interação do usuário, acessibilidade, feedback visual e composição de componentes.
- **ViewModel / Presenter / Hooks de tela**: estado derivado da UI, adaptação para apresentação e coordenação local de interação; sem regra de negócio central.
- **Coordinator / Router / Controller de fluxo**: fluxo entre páginas, jornadas, navegação, composição de casos de uso e transições de estado de alto nível; sem regra de negócio.
- **Service (Application)**: coordena casos de uso, transações, políticas de aplicação e dependências; conhece o domínio, mas não detalhes de framework visual.
- **Domain**: entidades, value objects, invariantes, serviços de domínio, enums e contratos estáveis do negócio; sem dependência de framework.
- **Core**: processamento técnico/algorítmico, engines internas, concorrência, parsing, transformação, políticas técnicas reutilizáveis e utilitários internos de alto valor sem acoplamento à borda.
- **Infrastructure**: adapta banco de dados, ORM, HTTP, filas, cache, storage, mensageria, autenticação externa, SDKs e formatos externos; implementa contratos internos e traduz modelos externos.
- **`src/app/` ou equivalente**: composition root, bootstrap, wiring, configuração de dependências, inicialização do servidor/app e registro de módulos.

## Dependências e fronteiras

- As dependências apontam de fora para dentro.
- UI, controllers, routers, handlers HTTP e composition root ficam na borda.
- `Infrastructure` implementa contratos internos e adapta dependências externas.
- `Service (Application)` pode depender de `Domain` e colaborar com `Core`.
- `Domain` não depende de camadas externas.
- DTOs, Commands, Queries, Results e contratos de caso de uso ficam em `Service (Application)`.
- Modelos e contratos estáveis do negócio ficam em `Domain`.
- Tipos técnicos internos ficam em `Core`.
- Tipos de framework, ORM, HTTP, SDK ou formatos externos ficam em `Infrastructure`.
- Modelos de apresentação e estado de interface ficam em `ViewModel`, `Presenter` ou camada equivalente.

## Regras de corte

- `View` não cria diretamente serviços de aplicação, clients externos, repositórios ou adapters de infraestrutura; a composição acontece em `src/app/` ou nos pontos oficiais do framework.
- `View` não acessa banco, filesystem, fila, cache, storage ou regra de negócio diretamente.
- Componentes de UI não devem conter autorização, regra de negócio ou decisão transacional.
- `ViewModel`, hooks de tela ou presenters não orquestram fluxo global; extraia para `Coordinator`, router-level logic ou camada equivalente quando isso surgir.
- Controllers, route handlers ou endpoints não devem conter regra de negócio significativa; eles traduzem request/response e delegam para `Service`.
- `Service` não depende de detalhes de componente, framework visual ou transporte HTTP específico, e não deve virar depósito de código técnico genérico.
- `Domain` não depende de UI, ORM, banco, rede, cache, storage, filas ou framework.
- `Infrastructure` não incorpora regra de negócio.
- `src/app/` ou equivalente não contém lógica de negócio.
- `Core` retorna dados estruturados; a apresentação e os adapters formatam resposta HTTP, HTML, JSON ou mensagens finais.
- Em dúvida de classificação, use a responsabilidade dominante e extraia o restante para colaboradores menores.

## Regras específicas para web

- Validação de borda (request, params, querystring, payload) deve acontecer na borda; invariantes de negócio continuam no domínio.
- Autenticação e autorização não devem ficar espalhadas por componentes e handlers; centralize em mecanismos previsíveis.
- Acesso a dados deve passar pelos contratos e pontos oficiais da arquitetura; não consultar banco diretamente de UI, component server ou controller, salvo convenção explícita do projeto.
- Side effects externos devem ser explícitos: chamadas HTTP, envio de email, fila, cache, storage, webhooks e integrações.
- Contratos públicos de API devem ser tratados como artefatos estáveis; mudanças exigem revisão de compatibilidade.
- Migrações de banco, alterações de schema, índices, filas e contratos assíncronos exigem cuidado especial com rollout e rollback.
- Cache deve ter chave, escopo, invalidação e motivo claros; não introduza cache implícito ou sem estratégia de expiração/invalidação.
- Observabilidade é parte do desenho: logs, métricas, tracing e tratamento de erro devem seguir os pontos padrão do projeto.
- SSR, SSG, ISR, workers, cron jobs e filas devem obedecer às mesmas fronteiras arquiteturais; trocar o runtime não autoriza misturar camadas.

## Guardrails de tamanho e coesão

- Função: alvo <= 20 linhas; revisar coesão e possível extração acima de 40.
- Classe: alvo <= 200 linhas; revisar responsabilidades acima de 300.
- Módulo: alvo <= 300 linhas; revisar separação, acoplamento e responsabilidade acima de 500.
- Componente de UI: revisar acima de 200 linhas ou quando misturar renderização, estado complexo, acesso externo e regra de negócio.
- Handler, controller ou endpoint: revisar quando acumular parsing, autorização, regra de negócio, orquestração e formatação de resposta no mesmo lugar.
- Revisar também quando houver > 5 argumentos, > 3 níveis de aninhamento, duplicação relevante, ou mistura de UI, regra de negócio e IO.
- Coesão e clareza prevalecem sobre contagem bruta; os limites são gatilhos de revisão.

## Critério de pronto

- A mudança é a menor possível para resolver o problema sem violar as fronteiras arquiteturais.
- Não há lógica de negócio nova em `View`, handlers HTTP, `Infrastructure` ou `src/app/`.
- Execute apenas comandos oficiais do projeto relevantes para a mudança e relate o resultado.
- Se a mudança afetar comportamento público, contrato de API, autenticação, autorização, versionamento, compatibilidade, persistência, cache, fila, build, deploy ou observabilidade, atualize os artefatos relevantes.
- Se alguma verificação não puder ser executada, declare exatamente o que faltou, por que faltou e o risco residual.

## Pedir confirmação antes de...

- adicionar dependências de produção;
- alterar a estratégia de versionamento público;
- mudar a fonte única da versão pública do sistema;
- alterar contratos públicos de API sem compatibilidade explícita;
- alterar schema, migrações, índices, persistência, formatos armazenados ou compatibilidade de dados;
- mudar estratégia de autenticação, autorização, sessão ou gestão de segredos;
- mudar cache, fila, mensageria, storage ou integrações externas de forma estrutural;
- mudar pipeline de build, container, CI/CD, deploy ou rollback;
- executar renomeações amplas, remoções em massa ou migrações sem rollback claro.

## Diretrizes de revisão

- Verifique vazamento de responsabilidade entre camadas.
- Verifique se `View`, handlers HTTP, `Infrastructure` ou `src/app/` absorveram regra de negócio indevida.
- Verifique acoplamento excessivo, módulos genéricos e crescimento descoeso.
- Verifique se mudanças de versionamento respeitam a fonte única.
- Verifique se contratos públicos continuam claros e consistentes.
- Verifique se autenticação, autorização, validação, persistência e observabilidade estão nos pontos corretos.
- Verifique se exceções temporárias estão sinalizadas com `TODO(arquitetura)` completo.

## Exceções

- Acúmulo temporário de responsabilidade só é aceitável quando for local, explícito e com intenção clara de extração.
- Exceções só locais e temporárias, com `TODO(arquitetura): motivo=<por que ainda não foi extraído>; risco=<risco de manter assim>; gatilho=<critério para quebrar depois>`.
- Se um artefato mistura estado de interface, fluxo, caso de uso, regra de negócio, processamento técnico ou adaptação de framework, divida.

## Arquivos auxiliares

- Para tarefas longas, refactors grandes ou migrações, mantenha o plano fora deste arquivo, em `PLANS.md` ou equivalente.
- Para critérios de revisão mais detalhados, use `code_review.md` se o projeto adotar esse arquivo.
- Para regras muito locais, prefira `AGENTS.md` em subdiretórios específicos em vez de sobrecarregar este arquivo raiz.