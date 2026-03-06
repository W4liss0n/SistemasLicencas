# Interface Web - Sistema de Licenças

## Descrição

Interface web administrativa para o Sistema de Gerenciamento de Assinaturas e Licenças. Construída com React, TypeScript e Material-UI.

## Funcionalidades

### Painel Administrativo
- Dashboard com métricas em tempo real
- Gerenciamento de clientes
- Controle de assinaturas
- Administração de licenças
- Monitoramento de segurança
- Analytics e relatórios

### Portal do Cliente
- Visualização de assinaturas ativas
- Gerenciamento de licenças
- Transferência de dispositivos
- Histórico de pagamentos

## Tecnologias

- **React 18** - Framework UI
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Material-UI** - Componentes UI
- **React Router** - Roteamento
- **Zustand** - Gerenciamento de estado
- **React Query** - Cache e sincronização
- **Recharts** - Gráficos e visualizações
- **Axios** - Cliente HTTP

## Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações
```

## Desenvolvimento

```bash
# Executar em modo desenvolvimento
npm run dev

# A aplicação estará disponível em:
# http://localhost:5173
```

## Build

```bash
# Criar build de produção
npm run build

# Preview do build
npm run preview
```

## Estrutura do Projeto

```
src/
├── components/      # Componentes reutilizáveis
├── pages/          # Páginas da aplicação
├── layouts/        # Layouts principais
├── services/       # Serviços e API
├── store/          # Estado global (Zustand)
├── types/          # Tipos TypeScript
├── hooks/          # Custom hooks
└── utils/          # Funções utilitárias
```

## Páginas Disponíveis

- `/login` - Página de autenticação
- `/dashboard` - Painel principal com métricas
- `/clientes` - Gerenciamento de clientes
- `/assinaturas` - Controle de assinaturas
- `/licencas` - Administração de licenças
- `/seguranca` - Monitoramento de segurança
- `/analytics` - Relatórios e análises
- `/configuracoes` - Configurações do sistema

## Integração com Backend

A aplicação se conecta ao backend através da API REST. Configure a URL do backend no arquivo `.env`:

```env
VITE_API_URL=http://localhost:3000
```

## Autenticação

A aplicação usa JWT para autenticação. O token é armazenado no localStorage e enviado automaticamente em todas as requisições.

## Desenvolvimento de Novos Recursos

1. Crie novos componentes em `src/components/`
2. Adicione novas páginas em `src/pages/`
3. Atualize rotas em `src/App.tsx`
4. Adicione tipos em `src/types/`
5. Implemente serviços em `src/services/`

## Scripts Disponíveis

- `npm run dev` - Inicia servidor de desenvolvimento
- `npm run build` - Cria build de produção
- `npm run preview` - Preview do build
- `npm run lint` - Executa linter

## Requisitos

- Node.js 18+
- NPM 9+
- Backend API rodando

## Suporte

Para problemas ou dúvidas, consulte a documentação do sistema em `/docs`.
