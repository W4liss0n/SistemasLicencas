"""
License validation constants and error messages.

Compatible with license_client v3.3.
"""

# Security constants
SOFT_CHECK_INTERVAL_DAYS = 7  # Try to reconnect every N days (before JWT expires)

# Mensagens de erro em português
# IMPORTANTE: Este dicionário contém APENAS mensagens para erros locais/offline
# Erros do servidor (license_blocked, subscription_expired, etc) são enviados
# diretamente pelo servidor no campo 'message' da resposta
ERROR_MESSAGES = {
    # Erros de conexão (cliente não consegue falar com servidor)
    "connection_error": "Sem conexão: Não foi possível conectar ao servidor de licenças. Usando validação offline.",
    "timeout": "Tempo esgotado: A conexão com o servidor demorou muito. Tentando validação offline.",
    "rate_limit": "Muitas tentativas: Você fez muitas requisições. Aguarde alguns minutos.",
    # Erros de cache local (validação offline do cliente)
    "cache_expired": "Sessão expirada: O período de validação offline foi ultrapassado. Conecte-se à internet.",
    "cache_tampered": "Cache adulterado: O cache local foi modificado indevidamente. Por segurança, a licença foi invalidada.",
    "cache_device_mismatch": "Dispositivo diferente: O cache não pertence a este dispositivo. Faça login novamente.",
    "cache_license_mismatch": "Licença incompatível: O cache não corresponde à licença atual.",
    "no_cached_license": "Sem licença: Nenhuma licença válida encontrada. Faça login para continuar.",
    "validation_limit_exceeded": "Limite de tentativas: Você excedeu o número máximo de validações offline. Conecte-se à internet para renovar.",
    # Mensagens genéricas (fallback quando servidor não envia mensagem)
    "unknown_error": "Erro desconhecido: Ocorreu um erro inesperado. Tente novamente.",
    "validation_failed": "Validação falhou: Não foi possível validar a licença.",
}
