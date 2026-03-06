export interface WriteValidationHistoryInput {
  licenseKey: string;
  success: boolean;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export interface WriteSecurityEventInput {
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, unknown>;
}

export interface WriteAuditLogInput {
  entityType: string;
  entityId: string;
  action: string;
  payload?: Record<string, unknown>;
}

export interface CountAuditLogsSinceInput {
  entityType: string;
  entityId: string;
  action: string;
  since: Date;
}

export const AUDIT_SECURITY_PORT = Symbol('AUDIT_SECURITY_PORT');

export interface AuditSecurityPort {
  writeValidationHistory(input: WriteValidationHistoryInput): Promise<void>;
  writeSecurityEvent(input: WriteSecurityEventInput): Promise<void>;
  writeAuditLog(input: WriteAuditLogInput): Promise<void>;
  countAuditLogsSince(input: CountAuditLogsSinceInput): Promise<number>;
}
