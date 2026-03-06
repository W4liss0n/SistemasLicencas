export enum LicenseStatus {
  ACTIVE = 'ativa',
  INACTIVE = 'inativa',
  BLOCKED = 'bloqueada',
  TRANSFERRED = 'transferida'
}

export enum SubscriptionStatus {
  ACTIVE = 'ativa',
  EXPIRED = 'expirada',
  CANCELLED = 'cancelada',
  SUSPENDED = 'suspensa'
}

export enum ClientStatus {
  ACTIVE = 'ativo',
  INACTIVE = 'inativo',
  SUSPENDED = 'suspenso'
}

export enum ProgramStatus {
  ACTIVE = 'ativo',
  INACTIVE = 'inativo'
}

export enum SecurityEventType {
  TIME_MANIPULATION = 'time_manipulation',
  FILE_TAMPERING = 'file_tampering',
  SUSPICIOUS_PROCESS = 'suspicious_process',
  MULTIPLE_INSTANCES = 'multiple_instances',
  IMPOSSIBLE_VELOCITY = 'impossible_velocity',
  EXCESSIVE_FINGERPRINTS = 'excessive_fingerprints',
  BRUTE_FORCE = 'brute_force',
  BLACKLISTED_IP = 'blacklisted_ip'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AutomatedAction {
  NONE = 'none',
  WARNING = 'warning',
  TEMPORARY_BLOCK = 'temporary_block',
  PERMANENT_BLOCK = 'permanent_block'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}