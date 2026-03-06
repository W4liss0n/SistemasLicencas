# Sistema de Gerenciamento de Licenças

Sistema robusto para gerenciamento de assinaturas e licenças de software com validação avançada, detecção de fraude e cache criptografado.

## Estrutura Implementada

### ✅ Componentes Concluídos

1. **Estrutura Base**
   - Configuração TypeScript
   - Estrutura de diretórios organizada
   - Configuração de ambiente (.env)

2. **Camada de Dados**
   - Modelos PostgreSQL (License, Subscription)
   - Migrações SQL estruturadas
   - Conexão com PostgreSQL e Redis
   - Índices otimizados

3. **Sistema de Autenticação**
   - Serviço JWT completo
   - Middleware de autenticação
   - Suporte para refresh tokens

4. **Core de Licenças**
   - Validação de licenças
   - Sistema de fingerprint ponderado
   - Transferência de licenças
   - Cache de validações

5. **API Gateway**
   - Servidor Express configurado
   - Middlewares de segurança (Helmet, CORS)
   - Rate limiting
   - Validação de requisições
   - Autenticação por API Key

## Como Executar

### Pré-requisitos

- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Instalação

1. **Clone e configure o ambiente:**
```bash
cd sistema-licencas
cp .env.example .env
# Edite .env com suas configurações
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure o banco de dados:**
```bash
# Crie o banco de dados PostgreSQL
createdb sistema_licencas

# Execute as migrações
npm run migrate
```

4. **Inicie o servidor:**
```bash
# Modo desenvolvimento
npm run dev

# Modo produção
npm run build
npm start
```

### Endpoints Disponíveis

#### Validação de Licença
```http
POST /api/v1/license/validate
Headers:
  X-Program-ID: <program_id>

Body:
{
  "license_key": "LIC-XXXX-XXXX-XXXX-XXXX",
  "device_fingerprint": {
    "components": {
      "motherboard_serial": { "value": "hash", "weight": 0.4, "stable": true },
      "disk_serial": { "value": "hash", "weight": 0.3, "stable": true },
      "mac_address": { "value": "hash", "weight": 0.2, "stable": true }
    },
    "algorithm": "weighted_v1"
  },
  "program_version": "1.2.3",
  "os_info": "Windows 11"
}
```

#### Health Check
```http
GET /health
```

## Próximos Passos

Para completar o sistema, ainda precisam ser implementados:

1. **Painel Administrativo**
   - CRUD de clientes
   - Gestão de planos e assinaturas
   - Dashboard de segurança

2. **Sistema de Segurança Avançado**
   - Detecção de fraude com ML
   - Análise comportamental
   - Geolocalização

3. **SDK Cliente**
   - Bibliotecas para Node.js, Python, C#
   - Validação offline
   - Cache local criptografado

4. **Monitoramento**
   - Logs estruturados
   - Métricas de performance
   - Alertas de segurança

## Estrutura de Diretórios

```
sistema-licencas/
├── src/
│   ├── api/                # API Gateway
│   ├── core/               # Lógica de negócio
│   ├── security/           # Segurança e autenticação
│   ├── cache/              # Sistema de cache
│   ├── data/               # Camada de dados
│   └── shared/             # Utilitários compartilhados
├── config/                 # Configurações
├── scripts/                # Scripts de automação
└── tests/                  # Testes automatizados
```

## Segurança

- **Autenticação**: JWT + API Keys
- **Criptografia**: AES-256 + HMAC-SHA256
- **Rate Limiting**: Por IP e API Key
- **Fingerprint**: Sistema ponderado com threshold configurável
- **Detecção de Fraude**: Análise de velocidade e padrões

## Licença

Proprietário
