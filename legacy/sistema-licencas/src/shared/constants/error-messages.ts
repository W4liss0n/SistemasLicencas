/**
 * Error Messages in Portuguese
 * Centralized error messages for consistent user experience
 */

export const ERROR_MESSAGES = {
  // License errors
  'license_blocked': '❌ Licença bloqueada: Sua licença foi bloqueada por violação de segurança.',
  'license_expired': '❌ Licença expirada: Sua assinatura venceu. Por favor, renove para continuar usando o programa.',
  'license_inactive': '❌ Licença inativa: Sua licença está inativa. Entre em contato com o suporte.',
  'license_not_found': '❌ Licença não encontrada: A chave de licença não foi encontrada no sistema.',

  // Subscription errors
  'subscription_expired': '❌ Assinatura expirada: Sua assinatura venceu. Entre em contato para renovar.',
  'subscription_not_found': '❌ Assinatura não encontrada: Não foi encontrada uma assinatura válida para sua licença.',
  'subscription_inactive': '❌ Assinatura inativa: Sua assinatura está inativa. Entre em contato para reativar.',

  // Device errors
  'device_limit_exceeded': '❌ Limite de dispositivos: Esta licença já está em uso no número máximo de dispositivos permitidos.',
  'max_devices_reached': '❌ Limite de dispositivos atingido: Esta licença já atingiu o número máximo de dispositivos permitidos.',
  'invalid_fingerprint': '❌ Dispositivo não autorizado: Este dispositivo não está autorizado para usar esta licença.',
  'fingerprint_mismatch': '❌ Dispositivo incompatível: O dispositivo atual não corresponde ao dispositivo autorizado.',

  // Program errors
  'program_not_allowed': '❌ Programa não autorizado: Esta licença não é válida para este programa.',
  'program_not_included': '❌ Programa não incluído: Este programa não está incluído no seu plano atual.',

  // Transfer errors
  'transfer_limit_exceeded': '❌ Limite de transferências: Você excedeu o limite mensal de transferências de licença.',
  'already_activated': '❌ Já ativada: Esta licença já está ativada em outro dispositivo.',

  // Authentication errors
  'invalid_credentials': '❌ Credenciais inválidas: Usuário/email ou senha incorretos.',
  'no_active_subscription': '❌ Sem assinatura ativa: Sua conta não possui uma assinatura ativa. Entre em contato para renovar.',

  // Offline validation errors
  'offline_token_expired': '❌ Token offline expirado: O período de validação offline expirou. Conecte-se à internet.',
  'invalid_offline_token': '❌ Token offline inválido: O token de validação offline não é válido. Faça login novamente.',

  // Validation errors
  'validation_error': '❌ Erro de validação: Ocorreu um erro ao validar a licença. Tente novamente.',
  'validation_failed': '❌ Validação falhou: Não foi possível validar a licença.',
  'invalid_license': '❌ Licença inválida: A chave de licença fornecida não é válida.',

  // Generic errors
  'unknown_error': '❌ Erro desconhecido: Ocorreu um erro inesperado. Tente novamente.',
  'invalid_request': '❌ Requisição inválida: Os dados fornecidos são inválidos.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

/**
 * Get error message by code
 */
export function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code as ErrorCode] || ERROR_MESSAGES['unknown_error'];
}
