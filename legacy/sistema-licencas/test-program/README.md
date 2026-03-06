# 🧪 Programa de Teste - Calculadora Licenciada

Este é um programa fictício para testar o sistema de licenças completo.

## 📋 Passo a Passo para Testar

### 1️⃣ **Preparar o Servidor**

```bash
# Terminal 1 - Iniciar o servidor
cd sistema-licencas
npm run dev
```

O servidor estará rodando em `http://localhost:3000`

### 2️⃣ **Acessar o Painel Admin**

1. Abra o navegador: `http://localhost:5173`
2. Faça login (use as credenciais que você configurou)

### 3️⃣ **Criar um Programa no Painel**

1. Vá em **Programas** → **Novo Programa**
2. Preencha:
   - Nome: `Test Calculator`
   - Descrição: `Programa de teste`
   - Versão: `1.0.0`
3. Salve e **COPIE O UUID** gerado

### 4️⃣ **Criar uma API Key**

1. No painel, vá em **Configurações** ou **API Keys**
2. Crie uma nova API Key pública
3. **COPIE A API KEY**

### 5️⃣ **Criar um Plano**

1. Vá em **Planos** → **Novo Plano**
2. Preencha:
   - Nome: `Plano Teste`
   - Preço: `50.00`
   - Duração: `30` dias
   - Max Licenças: `1`
   - Max Offline: `7` dias
3. **IMPORTANTE**: Adicione o programa `Test Calculator` ao plano
4. Salve

### 6️⃣ **Criar um Cliente**

1. Vá em **Clientes** → **Novo Cliente**
2. Preencha os dados do cliente teste
3. Salve

### 7️⃣ **Criar uma Assinatura**

1. Vá em **Assinaturas** → **Nova Assinatura**
2. Selecione:
   - Cliente: O cliente que você criou
   - Plano: `Plano Teste`
   - Data início: Hoje
   - Data fim: 30 dias no futuro
3. Salve - **Uma licença será gerada automaticamente**

### 8️⃣ **Pegar a Chave de Licença**

1. Vá em **Licenças**
2. Encontre a licença criada
3. **COPIE A CHAVE** (formato: LIC-XXXX-XXXX-XXXX)

### 9️⃣ **Configurar o Programa de Teste**

Edite o arquivo `test_calculator.py`:

```python
# Linha 29-33 - Substitua com seus dados:
self.validator = LicenseValidator(
    program_id="COLE-AQUI-O-UUID-DO-PROGRAMA",  # UUID do passo 3
    program_name="TestCalculator",
    version="1.0.0",
    api_url="http://localhost:3000",
    api_key="COLE-AQUI-A-API-KEY"  # API Key do passo 4
)
```

### 🚀 **Executar o Teste**

```bash
# Terminal 2 - Rodar o programa teste
cd test-program
python3 test_calculator.py
```

## 🎮 Cenários de Teste

### **Teste 1: Primeira Ativação**
1. Execute o programa
2. Digite a chave de licença quando solicitado
3. O programa deve ativar e mostrar o menu

### **Teste 2: Validação de Cache**
1. Feche o programa
2. Execute novamente
3. Deve validar automaticamente (sem pedir chave)

### **Teste 3: Transferência de Dispositivo**
1. Delete o arquivo de cache para simular outro PC:
   - Windows: `%APPDATA%\TestCalculator\`
   - Linux: `~/.config/TestCalculator/`
2. Execute o programa
3. Deve detectar licença em outro dispositivo
4. Escolha transferir (limite de 3x por mês)

### **Teste 4: Funcionamento Offline**
1. Com licença ativa, desligue o servidor
2. Execute o programa
3. Deve funcionar usando cache (até 7 dias offline)

### **Teste 5: Múltiplas Tentativas Falhas**
1. Digite uma chave inválida 10 vezes
2. O sistema deve bloquear após 10 tentativas

### **Teste 6: Detecção de Uso Simultâneo**
1. Ative em um PC
2. Copie a chave e tente ativar em outro PC/VM
3. Sistema deve detectar e oferecer transferência

## 📁 Estrutura de Arquivos Criados

Após ativação, o programa cria:

**Windows:**
```
%APPDATA%\TestCalculator\
  ├── license.dat    (cache criptografado)
  └── config.json    (chave de licença)
```

**Linux/Mac:**
```
~/.config/TestCalculator/
  ├── license.dat    (cache criptografado)
  └── config.json    (chave de licença)
```

## 🔍 Debugging

Para ver mais detalhes, você pode:

1. **Ver logs do servidor**: Check o terminal do `npm run dev`
2. **Ver banco de dados**:
   ```sql
   -- Conectar ao PostgreSQL
   psql -U postgres -d sistema_licencas

   -- Ver validações
   SELECT * FROM validation_history ORDER BY created_at DESC LIMIT 10;

   -- Ver transferências
   SELECT * FROM license_transfers ORDER BY created_at DESC;

   -- Ver eventos de segurança
   SELECT * FROM security_events ORDER BY created_at DESC;
   ```

## ⚙️ Opções do Menu

O programa de teste oferece:

1. **Usar Calculadora** - Funcionalidade principal (requer licença)
2. **Ver Status** - Mostra informações da licença
3. **Validar Online** - Força validação com servidor
4. **Desativar** - Remove licença deste PC
5. **Transferir** - Traz licença de outro PC
6. **Ativar Nova** - Ativa uma nova chave

## 🐛 Problemas Comuns

### "Cannot connect to license server"
- Verifique se o servidor está rodando (`npm run dev`)
- Confirme a URL: `http://localhost:3000`

### "API key not found"
- Verifique se copiou a API key corretamente
- A API key deve estar ativa no banco

### "Program not included in subscription plan"
- Verifique se o programa está vinculado ao plano
- O UUID do programa deve estar correto

### "License already activated on another device"
- Use a opção de transferência (máx 3/mês)
- Ou desative no outro dispositivo primeiro

## 📊 Monitoramento

No painel admin, você pode ver:
- Total de validações
- Dispositivos ativos
- Histórico de transferências
- Eventos de segurança
- Tentativas de fraude