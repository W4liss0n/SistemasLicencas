import { query } from '../../../data/database/config/postgres.config';
import { ILicense } from '../../../shared/interfaces/license.interface';
import { LicenseStatus } from '../../../shared/types/license.types';

export interface IActiveDeviceMatch {
  matched: boolean;
  licenseDeviceId?: string;
  primaryFingerprintId?: string;
  matchedFingerprintId?: string;
  matchedHash?: string;
  matchSource?: 'v2_exact' | 'v1_fallback';
  isAlias?: boolean;
}

export class LicenseModel {
  static async create(license: Partial<ILicense>): Promise<ILicense> {
    const text = `
      INSERT INTO licencas (
        assinatura_id, programa_id, license_key, device_fingerprint,
        status, max_offline_hours, ultimo_acesso, ultimo_ip
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      license.assinatura_id,
      license.programa_id,
      license.license_key,
      JSON.stringify(license.device_fingerprint),
      license.status || LicenseStatus.ACTIVE,
      license.max_offline_hours || 168,
      license.ultimo_acesso,
      license.ultimo_ip
    ];

    const result = await query(text, values);
    return result.rows[0];
  }

  static async findByKey(licenseKey: string): Promise<ILicense | null> {
    const text = `
      SELECT l.*, a.data_fim, a.status as subscription_status
      FROM licencas l
      LEFT JOIN assinaturas a ON l.assinatura_id = a.id
      WHERE l.license_key = $1
    `;

    const result = await query(text, [licenseKey]);
    return result.rows[0] || null;
  }

  static async findById(id: string): Promise<ILicense | null> {
    const text = 'SELECT * FROM licencas WHERE id = $1';
    const result = await query(text, [id]);
    return result.rows[0] || null;
  }

  static async update(id: string, updates: Partial<ILicense>): Promise<ILicense> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(key === 'device_fingerprint' ? JSON.stringify(value) : value);
        paramCount++;
      }
    });

    values.push(id);
    const text = `
      UPDATE licencas
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(text, values);
    return result.rows[0];
  }

  static async updateByKey(licenseKey: string, updates: Partial<ILicense>): Promise<ILicense> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'license_key' && (value !== undefined || Object.prototype.hasOwnProperty.call(updates, key))) {
        fields.push(`${key} = $${paramCount}`);
        values.push(key === 'device_fingerprint' && value ? JSON.stringify(value) : value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return await this.findByKey(licenseKey) as ILicense;
    }

    values.push(licenseKey);
    const text = `
      UPDATE licencas
      SET ${fields.join(', ')}
      WHERE license_key = $${paramCount}
      RETURNING *
    `;

    const result = await query(text, values);
    return result.rows[0];
  }

  static async findBySubscriptionId(subscriptionId: string): Promise<ILicense[]> {
    const text = `
      SELECT * FROM licencas
      WHERE assinatura_id = $1
      ORDER BY created_at DESC
    `;

    const result = await query(text, [subscriptionId]);
    return result.rows;
  }

  static async countByFingerprint(fingerprintHash: string, days: number = 30): Promise<number> {
    const text = `
      SELECT COUNT(DISTINCT license_key) as count
      FROM licencas
      WHERE device_fingerprint->>'fingerprint_hash' = $1
        AND created_at > NOW() - INTERVAL '${days} days'
    `;

    const result = await query(text, [fingerprintHash]);
    return parseInt(result.rows[0].count, 10);
  }

  static async deactivate(licenseKey: string): Promise<ILicense> {
    return await this.updateByKey(licenseKey, {
      status: LicenseStatus.INACTIVE
    });
  }

  static async block(licenseKey: string): Promise<ILicense> {
    return await this.updateByKey(licenseKey, {
      status: LicenseStatus.BLOCKED
    });
  }

  static async recordAccess(licenseKey: string, ip: string): Promise<void> {
    const text = `
      UPDATE licencas
      SET ultimo_acesso = CURRENT_TIMESTAMP,
          ultimo_ip = $2
      WHERE license_key = $1
    `;

    await query(text, [licenseKey, ip]);
  }

  /**
   * Device Management Methods
   */

  static async getDevices(licenseKey: string): Promise<any[]> {
    const text = `
      SELECT
        ld.*,
        df.fingerprint_hash,
        df.components,
        df.algorithm_version,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'fingerprint_hash', adf.fingerprint_hash,
              'components', adf.components,
              'algorithm_version', adf.algorithm_version,
              'alias_type', ldfa.alias_type,
              'expires_at', ldfa.expires_at
            )
          )
          FROM license_device_fingerprint_aliases ldfa
          INNER JOIN device_fingerprints adf ON adf.id = ldfa.device_fingerprint_id
          WHERE ldfa.license_device_id = ld.id
            AND (ldfa.expires_at IS NULL OR ldfa.expires_at > NOW())
        ), '[]'::json) AS fingerprint_aliases
      FROM license_devices ld
      INNER JOIN device_fingerprints df ON ld.device_fingerprint_id = df.id
      WHERE ld.license_key = $1
      ORDER BY ld.last_seen DESC
    `;

    const result = await query(text, [licenseKey]);
    return result.rows;
  }

  static async getActiveDevicesCount(licenseKey: string): Promise<number> {
    const text = `
      SELECT COUNT(*) as count
      FROM license_devices
      WHERE license_key = $1 AND is_active = TRUE
    `;

    const result = await query(text, [licenseKey]);
    return parseInt(result.rows[0].count, 10);
  }

  static async isDeviceRegistered(licenseKey: string, fingerprintHash: string): Promise<boolean> {
    const text = `
      SELECT ld.id
      FROM license_devices ld
      INNER JOIN device_fingerprints df ON ld.device_fingerprint_id = df.id
      LEFT JOIN license_device_fingerprint_aliases ldfa
        ON ldfa.license_device_id = ld.id
        AND (ldfa.expires_at IS NULL OR ldfa.expires_at > NOW())
      LEFT JOIN device_fingerprints adf ON adf.id = ldfa.device_fingerprint_id
      WHERE ld.license_key = $1
        AND ld.is_active = TRUE
        AND (df.fingerprint_hash = $2 OR adf.fingerprint_hash = $2)
      LIMIT 1
    `;

    const result = await query(text, [licenseKey, fingerprintHash]);
    return result.rows.length > 0;
  }

  static async findActiveDeviceMatch(
    licenseKey: string,
    hashes: { v1?: string; v2: string },
    allowV1Fallback: boolean
  ): Promise<IActiveDeviceMatch> {
    const v2Text = `
      SELECT
        ld.id AS license_device_id,
        ld.device_fingerprint_id AS primary_fingerprint_id,
        df.id AS matched_fingerprint_id,
        df.fingerprint_hash AS matched_hash
      FROM license_devices ld
      INNER JOIN device_fingerprints df ON df.id = ld.device_fingerprint_id
      WHERE ld.license_key = $1
        AND ld.is_active = TRUE
        AND df.fingerprint_hash = $2
      LIMIT 1
    `;

    const v2Result = await query(v2Text, [licenseKey, hashes.v2]);
    if (v2Result.rows.length > 0) {
      const row = v2Result.rows[0];
      return {
        matched: true,
        licenseDeviceId: row.license_device_id,
        primaryFingerprintId: row.primary_fingerprint_id,
        matchedFingerprintId: row.matched_fingerprint_id,
        matchedHash: row.matched_hash,
        matchSource: 'v2_exact',
        isAlias: false
      };
    }

    if (!allowV1Fallback || !hashes.v1) {
      return { matched: false };
    }

    const v1Text = `
      SELECT
        ld.id AS license_device_id,
        ld.device_fingerprint_id AS primary_fingerprint_id,
        CASE
          WHEN df.fingerprint_hash = $2 THEN df.id
          ELSE adf.id
        END AS matched_fingerprint_id,
        CASE
          WHEN df.fingerprint_hash = $2 THEN df.fingerprint_hash
          ELSE adf.fingerprint_hash
        END AS matched_hash,
        CASE
          WHEN df.fingerprint_hash = $2 THEN FALSE
          ELSE TRUE
        END AS is_alias
      FROM license_devices ld
      INNER JOIN device_fingerprints df ON df.id = ld.device_fingerprint_id
      LEFT JOIN license_device_fingerprint_aliases ldfa
        ON ldfa.license_device_id = ld.id
        AND (ldfa.expires_at IS NULL OR ldfa.expires_at > NOW())
      LEFT JOIN device_fingerprints adf ON adf.id = ldfa.device_fingerprint_id
      WHERE ld.license_key = $1
        AND ld.is_active = TRUE
        AND (df.fingerprint_hash = $2 OR adf.fingerprint_hash = $2)
      ORDER BY CASE WHEN df.fingerprint_hash = $2 THEN 0 ELSE 1 END
      LIMIT 1
    `;

    const v1Result = await query(v1Text, [licenseKey, hashes.v1]);
    if (v1Result.rows.length === 0) {
      return { matched: false };
    }

    const row = v1Result.rows[0];
    return {
      matched: true,
      licenseDeviceId: row.license_device_id,
      primaryFingerprintId: row.primary_fingerprint_id,
      matchedFingerprintId: row.matched_fingerprint_id,
      matchedHash: row.matched_hash,
      matchSource: 'v1_fallback',
      isAlias: row.is_alias
    };
  }

  static async getOrCreateFingerprint(
    fingerprintHash: string,
    components: any,
    algorithmVersion: string
  ): Promise<string> {
    const text = `
      INSERT INTO device_fingerprints (fingerprint_hash, components, algorithm_version)
      VALUES ($1, $2, $3)
      ON CONFLICT (fingerprint_hash)
      DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const result = await query(text, [fingerprintHash, components, algorithmVersion]);
    return result.rows[0].id;
  }

  static async registerDevice(
    licenseKey: string,
    fingerprintId: string,
    deviceName?: string,
    lastIp?: string,
    matchSource: string = 'new_registration'
  ): Promise<string> {
    const text = `
      INSERT INTO license_devices (license_key, device_fingerprint_id, device_name, last_ip, is_active, last_match_source)
      VALUES ($1, $2, $3, $4, TRUE, $5)
      ON CONFLICT (license_key, device_fingerprint_id)
      DO UPDATE SET
        is_active = TRUE,
        last_seen = CURRENT_TIMESTAMP,
        last_ip = EXCLUDED.last_ip,
        last_match_source = EXCLUDED.last_match_source
      RETURNING id
    `;

    const result = await query(text, [licenseKey, fingerprintId, deviceName, lastIp, matchSource]);
    return result.rows[0].id;
  }

  static async addFingerprintAlias(
    licenseDeviceId: string,
    fingerprintId: string,
    aliasType: 'v1_fallback' | 'legacy_primary',
    expiresAt?: string | null
  ): Promise<void> {
    const text = `
      INSERT INTO license_device_fingerprint_aliases (
        license_device_id,
        device_fingerprint_id,
        alias_type,
        expires_at
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (license_device_id, device_fingerprint_id)
      DO UPDATE SET
        alias_type = EXCLUDED.alias_type,
        expires_at = EXCLUDED.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `;

    await query(text, [licenseDeviceId, fingerprintId, aliasType, expiresAt ?? null]);
  }

  static async promotePrimaryFingerprint(
    licenseDeviceId: string,
    newFingerprintId: string,
    matchSource: 'v2_exact' | 'v1_fallback' | 'reconciled_components' | 'new_registration',
    lastIp?: string
  ): Promise<void> {
    const text = `
      UPDATE license_devices
      SET
        device_fingerprint_id = $2,
        is_active = TRUE,
        last_seen = CURRENT_TIMESTAMP,
        last_ip = $4,
        reconciled_to_v2_at = COALESCE(reconciled_to_v2_at, CURRENT_TIMESTAMP),
        last_match_source = $3
      WHERE id = $1
    `;

    await query(text, [licenseDeviceId, newFingerprintId, matchSource, lastIp]);
  }

  static async updateDeviceLastSeen(licenseKey: string, fingerprintHash: string, lastIp?: string): Promise<void> {
    const resolved = await this.resolveDeviceByAnyHash(licenseKey, fingerprintHash, true);
    if (!resolved) {
      return;
    }

    await this.updateDeviceLastSeenById(resolved.licenseDeviceId, lastIp);
  }

  static async updateDeviceLastSeenById(
    licenseDeviceId: string,
    lastIp?: string,
    matchSource?: 'v2_exact' | 'v1_fallback' | 'reconciled_components' | 'new_registration'
  ): Promise<void> {
    const text = `
      UPDATE license_devices
      SET
        last_seen = CURRENT_TIMESTAMP,
        last_ip = COALESCE($2, last_ip),
        last_match_source = COALESCE($3, last_match_source)
      WHERE id = $1
    `;

    await query(text, [licenseDeviceId, lastIp ?? null, matchSource ?? null]);
  }

  static async deactivateDevice(licenseKey: string, fingerprintHash: string): Promise<void> {
    await this.deactivateDeviceByAnyHash(licenseKey, fingerprintHash);
  }

  static async deactivateDeviceByAnyHash(licenseKey: string, fingerprintHash: string): Promise<void> {
    const resolved = await this.resolveDeviceByAnyHash(licenseKey, fingerprintHash, false);
    if (!resolved) {
      return;
    }

    const text = `
      UPDATE license_devices
      SET is_active = FALSE
      WHERE id = $1
    `;
    await query(text, [resolved.licenseDeviceId]);
  }

  static async reactivateDevice(licenseKey: string, fingerprintHash: string, lastIp?: string): Promise<void> {
    const resolved = await this.resolveDeviceByAnyHash(licenseKey, fingerprintHash, false);
    if (!resolved) {
      return;
    }

    const text = `
      UPDATE license_devices
      SET
        is_active = TRUE,
        last_seen = CURRENT_TIMESTAMP,
        last_ip = $2
      WHERE id = $1
    `;

    await query(text, [resolved.licenseDeviceId, lastIp ?? null]);
  }

  static async removeDevice(licenseKey: string, fingerprintHash: string): Promise<void> {
    await this.removeDeviceByAnyHash(licenseKey, fingerprintHash);
  }

  static async removeDeviceByAnyHash(licenseKey: string, fingerprintHash: string): Promise<void> {
    const resolved = await this.resolveDeviceByAnyHash(licenseKey, fingerprintHash, false);
    if (!resolved) {
      return;
    }

    const text = `
      DELETE FROM license_devices
      WHERE id = $1
    `;
    await query(text, [resolved.licenseDeviceId]);
  }

  static async getActiveDevicesForReconciliation(licenseKey: string): Promise<any[]> {
    const text = `
      SELECT
        ld.id AS license_device_id,
        ld.device_fingerprint_id AS primary_fingerprint_id,
        ld.last_seen,
        ld.last_ip,
        ld.reconciled_to_v2_at,
        ld.last_match_source,
        df.fingerprint_hash AS primary_hash,
        df.components AS primary_components,
        df.algorithm_version AS primary_algorithm,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'fingerprint_id', adf.id,
              'fingerprint_hash', adf.fingerprint_hash,
              'components', adf.components,
              'algorithm_version', adf.algorithm_version,
              'alias_type', ldfa.alias_type,
              'expires_at', ldfa.expires_at
            )
          )
          FROM license_device_fingerprint_aliases ldfa
          INNER JOIN device_fingerprints adf ON adf.id = ldfa.device_fingerprint_id
          WHERE ldfa.license_device_id = ld.id
            AND (ldfa.expires_at IS NULL OR ldfa.expires_at > NOW())
        ), '[]'::json) AS aliases
      FROM license_devices ld
      INNER JOIN device_fingerprints df ON df.id = ld.device_fingerprint_id
      WHERE ld.license_key = $1
        AND ld.is_active = TRUE
      ORDER BY ld.last_seen DESC
    `;

    const result = await query(text, [licenseKey]);
    return result.rows;
  }

  private static async resolveDeviceByAnyHash(
    licenseKey: string,
    fingerprintHash: string,
    activeOnly: boolean
  ): Promise<{ licenseDeviceId: string } | null> {
    const text = `
      SELECT ld.id AS license_device_id
      FROM license_devices ld
      INNER JOIN device_fingerprints df ON df.id = ld.device_fingerprint_id
      LEFT JOIN license_device_fingerprint_aliases ldfa
        ON ldfa.license_device_id = ld.id
        AND (ldfa.expires_at IS NULL OR ldfa.expires_at > NOW())
      LEFT JOIN device_fingerprints adf ON adf.id = ldfa.device_fingerprint_id
      WHERE ld.license_key = $1
        ${activeOnly ? 'AND ld.is_active = TRUE' : ''}
        AND (df.fingerprint_hash = $2 OR adf.fingerprint_hash = $2)
      LIMIT 1
    `;

    const result = await query(text, [licenseKey, fingerprintHash]);
    if (result.rows.length === 0) {
      return null;
    }

    return { licenseDeviceId: result.rows[0].license_device_id };
  }
}
