# 📦 RESUMO: JWT Offline Completo - Mudanças no Servidor

**Data:** 2025-10-16
**Status:** ✅ IMPLEMENTADO E PRONTO
**Objetivo:** JWT offline agora contém **todos os dados do cliente** para exibição offline

---

## 🎯 O QUE FOI IMPLEMENTADO NO SERVIDOR

### 1. **Payload do JWT Offline Expandido**

O JWT agora inclui **TODOS** os dados necessários para o cliente funcionar offline:

```json
{
  // ===== CAMPOS JÁ EXISTENTES =====
  "iss": "sistema-licencas",
  "aud": "license-client",
  "iat": 1729119600,
  "exp": 1729724400,
  "tokenType": "offline_license",
  "license_key": "LIC-ABCD-1234-EFGH-5678",
  "fingerprint_hash": "sha256:a1b2c3...",
  "valid_until": "2025-10-23T00:00:00Z",
  "nonce": 42,
  "issued_at": "2025-10-16T00:00:00Z",
  "soft_check_after": "2025-10-20T00:00:00Z",
  "max_offline_validations": 100,

  // ===== ⭐ NOVOS CAMPOS ADICIONADOS =====
  "license_expires_at": "2026-01-01T00:00:00Z",  // Data que a LICENÇA expira (não o JWT!)
  "client_id": "uuid-abc-123",                     // ID do cliente
  "client_username": "joao.silva",                 // Username/email do usuário
  "client_name": "João Silva",                     // Nome completo
  "client_email": "joao@example.com",              // Email
  "client_plan": "Premium"                         // Nome do plano
}
```

### 2. **Chaves RSA Geradas**

✅ Chaves RSA 2048 bits geradas e configuradas em `.env`:
- `RSA_PRIVATE_KEY`: Mantida secreta no servidor (nunca enviar ao cliente!)
- `RSA_PUBLIC_KEY`: Enviada ao cliente em cada resposta

### 3. **Endpoints Atualizados**

Todos os endpoints que retornam `offline_token` agora incluem os dados do cliente:

#### **POST /api/v1/license/validate** (Validação online)
```json
{
  "valid": true,
  "offline_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "public_key": "-----BEGIN PUBLIC KEY-----\nMIIBIj...",
  "license_info": {
    "license_key": "LIC-...",
    "expiration": "2026-01-01T00:00:00Z",
    "plan_name": "Premium",
    "max_offline_hours": 168
  },
  "fingerprint": { ... },
  "security": { ... }
}
```

#### **POST /api/v1/license/authenticate** (Login com usuário/senha)
```json
{
  "success": true,
  "authenticated": true,
  "license_key": "LIC-...",
  "offline_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "public_key": "-----BEGIN PUBLIC KEY-----\nMIIBIj...",
  "client": {
    "id": "uuid-abc-123",
    "usuario": "joao.silva",
    "nome": "João Silva",
    "email": "joao@example.com",
    "plano": "Premium"
  },
  "license_info": { ... },
  "fingerprint": { ... }
}
```

---

## 📋 O QUE O CLIENTE PRECISA FAZER

### **1. Extrair e Armazenar os Novos Campos do JWT**

Ao decodificar o JWT offline, extrair **TODOS** os campos:

```python
# Python: Decodificar JWT com chave pública RSA
import jwt

payload = jwt.decode(
    offline_token,
    public_key,
    algorithms=['RS256'],
    audience='license-client',
    issuer='sistema-licencas'
)

# ⭐ NOVOS CAMPOS DISPONÍVEIS:
client_data = {
    'license_key': payload['license_key'],
    'license_expires_at': payload.get('license_expires_at'),  # Data de expiração da LICENÇA
    'client_id': payload.get('client_id'),
    'client_username': payload.get('client_username'),
    'client_name': payload.get('client_name'),
    'client_email': payload.get('client_email'),
    'client_plan': payload.get('client_plan'),
    'valid_until': payload['valid_until'],  # Data de expiração do JWT offline
    'fingerprint_hash': payload['fingerprint_hash'],
    'soft_check_after': payload['soft_check_after'],
    'max_offline_validations': payload['max_offline_validations']
}
```

```delphi
// Delphi: Usar biblioteca JOSE & JWT para decodificar
uses
  JOSE.Core.JWT,
  JOSE.Core.JWK,
  JOSE.Core.Builder;

var
  LToken: TJWT;
  LKey: TJWK;
  ClientData: TClientData;
begin
  // Carregar chave pública RSA
  LKey := TJWK.Create(PublicKeyPEM);

  // Decodificar e verificar JWT
  LToken := TJOSE.Verify(LKey, OfflineToken);

  // ⭐ EXTRAIR NOVOS CAMPOS:
  ClientData.LicenseKey := LToken.Claims.FindClaimValue('license_key');
  ClientData.LicenseExpiresAt := LToken.Claims.FindClaimValue('license_expires_at');
  ClientData.ClientUsername := LToken.Claims.FindClaimValue('client_username');
  ClientData.ClientName := LToken.Claims.FindClaimValue('client_name');
  ClientData.ClientEmail := LToken.Claims.FindClaimValue('client_email');
  ClientData.ClientPlan := LToken.Claims.FindClaimValue('client_plan');
end;
```

### **2. Exibir Dados do Cliente na Interface (Offline)**

Com os novos campos, o cliente pode exibir **tudo** offline:

```
┌─────────────────────────────────────────────────────┐
│ SISTEMA OFFLINE                                     │
├─────────────────────────────────────────────────────┤
│ Usuário: João Silva (@joao.silva)                  │
│ Email: joao@example.com                             │
│ Plano: Premium                                      │
│                                                      │
│ Licença: LIC-ABCD-1234-EFGH-5678                   │
│ Expira em: 01/01/2026 00:00                        │
│                                                      │
│ Modo offline expira em: 23/10/2025 00:00          │
│ Validações offline restantes: 98/100               │
│                                                      │
│ ⚠️ Conecte-se à internet antes de 20/10/2025      │
└─────────────────────────────────────────────────────┘
```

### **3. Validar Expiração da Licença (Não do JWT!)**

**IMPORTANTE:** O campo `license_expires_at` é diferente de `exp` (JWT expiration):

- `exp` (JWT expiration): Quando o token offline expira (7 dias por padrão)
- `license_expires_at`: Quando a **assinatura do cliente** expira (pode ser meses/anos)

```python
from datetime import datetime

# Validar se a licença está expirada
license_expiration = datetime.fromisoformat(payload['license_expires_at'].replace('Z', '+00:00'))

if datetime.now() > license_expiration:
    print("❌ Sua assinatura expirou! Por favor, renove para continuar usando o software.")
    return False

# Validar se o token offline está expirado
jwt_expiration = datetime.fromisoformat(payload['valid_until'].replace('Z', '+00:00'))

if datetime.now() > jwt_expiration:
    print("⚠️ Período offline expirado. Conecte-se à internet para renovar.")
    return False
```

### **4. Implementar Soft Check Warning**

Quando `soft_check_after` for ultrapassado, avisar o usuário:

```python
soft_check_time = datetime.fromisoformat(payload['soft_check_after'].replace('Z', '+00:00'))

if datetime.now() > soft_check_time:
    print("⚠️ AVISO: Você está offline há muito tempo. Conecte-se à internet em breve para evitar bloqueios.")
```

---

## 🔒 SEGURANÇA - VALIDAÇÃO DO JWT NO CLIENTE

### **Checklist de Validação Obrigatória**

O cliente **DEVE** validar o JWT offline com as seguintes verificações:

```python
import jwt
from datetime import datetime

def validar_jwt_offline(token, public_key, device_fingerprint_hash):
    """Valida JWT offline com TODAS as verificações de segurança"""

    try:
        # 1. ✅ VERIFICAR ASSINATURA RSA
        payload = jwt.decode(
            token,
            public_key,
            algorithms=['RS256'],  # OBRIGATÓRIO: RS256 (RSA)
            audience='license-client',
            issuer='sistema-licencas'
        )

        # 2. ✅ VERIFICAR FINGERPRINT
        if payload['fingerprint_hash'] != device_fingerprint_hash:
            raise Exception("JWT não pertence a este dispositivo!")

        # 3. ✅ VERIFICAR EXPIRAÇÃO DO JWT
        valid_until = datetime.fromisoformat(payload['valid_until'].replace('Z', '+00:00'))
        if datetime.now() > valid_until:
            raise Exception("Período offline expirado!")

        # 4. ✅ VERIFICAR EXPIRAÇÃO DA LICENÇA
        if 'license_expires_at' in payload:
            license_expiration = datetime.fromisoformat(payload['license_expires_at'].replace('Z', '+00:00'))
            if datetime.now() > license_expiration:
                raise Exception("Assinatura expirada!")

        # 5. ✅ VERIFICAR TIPO DE TOKEN
        if payload.get('tokenType') != 'offline_license':
            raise Exception("Tipo de token inválido!")

        # 6. ✅ INCREMENTAR CONTADOR DE VALIDAÇÕES (opcional)
        current_validations = get_offline_validation_count(payload['license_key'])
        max_validations = payload.get('max_offline_validations', 100)

        if current_validations >= max_validations:
            raise Exception("Limite de validações offline atingido!")

        increment_offline_validation_count(payload['license_key'])

        return {
            'valid': True,
            'client_data': {
                'username': payload.get('client_username'),
                'name': payload.get('client_name'),
                'email': payload.get('client_email'),
                'plan': payload.get('client_plan')
            }
        }

    except jwt.ExpiredSignatureError:
        return {'valid': False, 'error': 'Token expirado'}
    except jwt.InvalidSignatureError:
        return {'valid': False, 'error': 'Assinatura inválida'}
    except Exception as e:
        return {'valid': False, 'error': str(e)}
```

---

## 📊 EXEMPLO COMPLETO DE FLUXO

### **1. Login Inicial (Online)**

```http
POST /api/v1/license/authenticate
Content-Type: application/json

{
  "username": "joao.silva",
  "password": "senha123",
  "device_fingerprint": {
    "machine_id": "ABC-123",
    "disk_serial": "SSD-456",
    "mac_address": "00:11:22:33:44:55"
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "authenticated": true,
  "license_key": "LIC-F7P3-HD4A-1ES8-DRXH",
  "offline_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJsaWNlbnNlX2tleSI6IkxJQy1GN1AzLUhENEEtMUVTOC1EUlhIIiwiZmluZ2VycHJpbnRfaGFzaCI6InNoYTI1NjphMWIyYzMuLi4iLCJ2YWxpZF91bnRpbCI6IjIwMjUtMTAtMjNUMDA6MDA6MDBaIiwibm9uY2UiOjQyLCJpc3N1ZWRfYXQiOiIyMDI1LTEwLTE2VDAwOjAwOjAwWiIsInNvZnRfY2hlY2tfYWZ0ZXIiOiIyMDI1LTEwLTIwVDAwOjAwOjAwWiIsIm1heF9vZmZsaW5lX3ZhbGlkYXRpb25zIjoxMDAsInRva2VuVHlwZSI6Im9mZmxpbmVfbGljZW5zZSIsImxpY2Vuc2VfZXhwaXJlc19hdCI6IjIwMjYtMDEtMDFUMDA6MDA6MDBaIiwiY2xpZW50X2lkIjoidXVpZC1hYmMtMTIzIiwiY2xpZW50X3VzZXJuYW1lIjoiam9hby5zaWx2YSIsImNsaWVudF9uYW1lIjoiSm_Do28gU2lsdmEiLCJjbGllbnRfZW1haWwiOiJqb2FvQGV4YW1wbGUuY29tIiwiY2xpZW50X3BsYW4iOiJQcmVtaXVtIiwiaWF0IjoxNzI5MTE5NjAwLCJleHAiOjE3Mjk3MjQ0MDAsImlzcyI6InNpc3RlbWEtbGljZW5jYXMiLCJhdWQiOiJsaWNlbnNlLWNsaWVudCJ9...",
  "public_key": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4MjDsvJTU74sGEH27IPT\ntabJ4lM/InGI+WToyZkGOMClcWDJb1jJC2L6iRDRVMD1TbvzPXp7kyd28o8jLwAU\nT+nJ/H4K6vPUSuMpAPFw56coJ6Bx4AaprQsJtbAe9evyFPmaI12tnIxubG6XOyok\ns9xPRShcwb5ry/Sq0LMOEjemQ7a0xHfMU9slRUnRbb2Cc5kFu5YDrSXAzoKI27sP\nGZjihKqEQuuQfYrnn5noImaqcWyeUsqnfyyoUevfaAfHIWdelDTLIo7uHJ8C0d8v\n4+T7sWxDPgCupUXb+2uk1LjhcbMge+u6u3dN1WHxv9FMCrJRXBA4SItmJcFQ1Oh5\nuwIDAQAB\n-----END PUBLIC KEY-----\n",
  "client": {
    "id": "uuid-abc-123",
    "usuario": "joao.silva",
    "nome": "João Silva",
    "email": "joao@example.com",
    "plano": "Premium"
  }
}
```

### **2. Armazenar no Cliente**

```python
# Salvar em storage seguro
storage.save({
    'offline_token': response['offline_token'],
    'public_key': response['public_key'],
    'license_key': response['license_key'],
    'last_sync': datetime.now().isoformat()
})
```

### **3. Validar Offline**

```python
# Carregar do storage
token = storage.get('offline_token')
public_key = storage.get('public_key')
device_hash = calculate_device_fingerprint_hash()

# Validar
result = validar_jwt_offline(token, public_key, device_hash)

if result['valid']:
    print(f"✅ Bem-vindo, {result['client_data']['name']}!")
    print(f"📧 Email: {result['client_data']['email']}")
    print(f"📦 Plano: {result['client_data']['plan']}")
else:
    print(f"❌ Validação falhou: {result['error']}")
```

---

## 🚀 PRÓXIMOS PASSOS PARA O CLIENTE

### **Checklist de Implementação:**

- [ ] **1. Instalar biblioteca JWT** (PyJWT para Python ou Delphi JOSE & JWT)
- [ ] **2. Atualizar código de login** para armazenar `offline_token` e `public_key`
- [ ] **3. Implementar função `validar_jwt_offline()`** com todas as verificações
- [ ] **4. Extrair campos do cliente** do payload (`client_username`, `client_name`, etc.)
- [ ] **5. Atualizar interface** para exibir dados do usuário offline
- [ ] **6. Implementar aviso de soft check** (`soft_check_after`)
- [ ] **7. Implementar contador de validações offline** (opcional mas recomendado)
- [ ] **8. Validar expiração da licença** (`license_expires_at`) separadamente do JWT

---

## ⚠️ AVISOS IMPORTANTES

### **Para o Cliente:**

1. **NUNCA** aceitar JWT sem validar assinatura RSA
2. **SEMPRE** verificar se `fingerprint_hash` corresponde ao dispositivo atual
3. **SEMPRE** verificar tanto `license_expires_at` quanto `valid_until` (JWT expiration)
4. **SALVAR** `public_key` no primeiro login (é a mesma para todos os tokens)
5. **INCREMENTAR** contador de validações offline a cada verificação
6. **AVISAR** usuário quando `soft_check_after` for ultrapassado

### **Diferenças entre Datas:**

| Campo | Significado | Típico |
|-------|-------------|--------|
| `exp` (JWT claim) | Quando o JWT offline expira | 7 dias |
| `valid_until` | Mesma informação que `exp` (em ISO format) | 7 dias |
| `license_expires_at` | Quando a assinatura do cliente expira | Meses/anos |
| `soft_check_after` | Aviso para reconectar | 3.5 dias (50%) |

---

## 📚 BIBLIOTECAS RECOMENDADAS

### **Python:**
```bash
pip install PyJWT[crypto]
```

```python
import jwt
payload = jwt.decode(token, public_key, algorithms=['RS256'])
```

### **Delphi:**
- **Delphi JOSE & JWT**: https://github.com/paolo-rossi/delphi-jose-jwt
- Suporta RS256, verificação de assinatura, e claims customizados

---

## ✅ RESUMO FINAL

| Item | Status | Descrição |
|------|--------|-----------|
| JWT com dados do cliente | ✅ PRONTO | Todos os campos adicionados |
| Chaves RSA geradas | ✅ PRONTO | Private/Public em `.env` |
| Endpoint `/validate` atualizado | ✅ PRONTO | Retorna token com dados |
| Endpoint `/authenticate` atualizado | ✅ PRONTO | Retorna token com dados |
| Servidor testado | ✅ PRONTO | Build sem erros críticos |

**🎉 O SERVIDOR ESTÁ PRONTO! Agora é só o cliente implementar a decodificação e exibição dos dados.**

---

**Desenvolvido por:** Walisson
**Data:** 2025-10-16
**Versão do Servidor:** 1.0.0
**Algoritmo JWT:** RS256 (RSA 2048 bits)
