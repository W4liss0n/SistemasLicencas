import pool from '../../../data/database/config/postgres.config';

export interface AuditLogEntry {
  entity_type: string;
  entity_id?: string;
  action: string;
  performed_by?: string;
  ip_address?: string;
  user_agent?: string;
  old_values?: any;
  new_values?: any;
  metadata?: any;
}

export class AuditLogService {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const query = `
        INSERT INTO audit_logs (
          entity_type,
          entity_id,
          action,
          performed_by,
          ip_address,
          user_agent,
          old_values,
          new_values,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      `;

      await pool.query(query, [
        entry.entity_type,
        entry.entity_id || null,
        entry.action,
        entry.performed_by || null,
        entry.ip_address || null,
        entry.user_agent || null,
        entry.old_values ? JSON.stringify(entry.old_values) : null,
        entry.new_values ? JSON.stringify(entry.new_values) : null,
      ]);
    } catch (error) {
      console.error('Error logging audit entry:', error);
    }
  }

  async logLogin(
    userId: string,
    email: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      entity_type: 'user',
      entity_id: userId || undefined,
      action: success ? 'login_success' : 'login_failed',
      performed_by: userId || undefined,
      ip_address: ipAddress,
      user_agent: userAgent,
      new_values: { email, timestamp: new Date().toISOString() }
    });
  }

  async logLicenseValidation(
    licenseKey: string,
    programId: string,
    success: boolean,
    ipAddress?: string,
    details?: any
  ): Promise<void> {
    // Buscar o ID da licença pelo license_key
    let licenseId: string | undefined;
    try {
      const result = await pool.query(
        'SELECT id FROM licencas WHERE license_key = $1',
        [licenseKey]
      );
      licenseId = result.rows[0]?.id;
    } catch (error) {
      console.error('Error fetching license ID for audit:', error);
    }

    await this.log({
      entity_type: 'license',
      entity_id: licenseId,
      action: success ? 'validation_success' : 'validation_failed',
      ip_address: ipAddress,
      new_values: {
        license_key: licenseKey,
        program_id: programId,
        success,
        timestamp: new Date().toISOString(),
        ...details
      }
    });
  }

  async logApiAccess(
    apiKey: string,
    endpoint: string,
    method: string,
    ipAddress?: string,
    userAgent?: string,
    statusCode?: number
  ): Promise<void> {
    await this.log({
      entity_type: 'api_key',
      entity_id: apiKey,
      action: 'api_access',
      ip_address: ipAddress,
      user_agent: userAgent,
      new_values: {
        endpoint,
        method,
        status_code: statusCode,
        timestamp: new Date().toISOString()
      }
    });
  }

  async logCrudOperation(
    entityType: string,
    entityId: string,
    action: 'create' | 'update' | 'delete',
    userId?: string,
    oldValues?: any,
    newValues?: any
  ): Promise<void> {
    await this.log({
      entity_type: entityType,
      entity_id: entityId,
      action,
      performed_by: userId,
      old_values: oldValues,
      new_values: newValues
    });
  }

  async logEvent(
    action: string,
    entityType: string,
    entityId: string | null,
    metadata?: any
  ): Promise<void> {
    await this.log({
      entity_type: entityType,
      entity_id: entityId || undefined,
      action,
      new_values: metadata
    });
  }

  async getRecentLogs(limit: number = 50): Promise<any[]> {
    const query = `
      SELECT
        id,
        entity_type,
        entity_id,
        action,
        performed_by,
        ip_address,
        user_agent,
        old_values,
        new_values,
        created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }
}

export const auditLogService = new AuditLogService();