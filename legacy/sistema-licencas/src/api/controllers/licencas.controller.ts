import { Request, Response } from 'express';
import pool from '../../data/database/config/postgres.config';
import redis from '../../data/database/config/redis.config';

export class LicencasController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT
          l.*,
          json_build_object(
            'id', a.id,
            'data_inicio', a.data_inicio,
            'data_fim', a.data_fim,
            'status', a.status,
            'cliente', json_build_object(
              'id', c.id,
              'nome', c.nome,
              'email', c.email
            ),
            'plano', json_build_object(
              'id', pl.id,
              'nome', pl.nome
            )
          ) as assinatura
        FROM licencas l
        LEFT JOIN assinaturas a ON l.assinatura_id = a.id
        LEFT JOIN clientes c ON a.cliente_id = c.id
        LEFT JOIN planos pl ON a.plano_id = pl.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramCount = 1;

      if (search) {
        query += ` AND (l.license_key ILIKE $${paramCount} OR c.nome ILIKE $${paramCount} OR c.email ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
      }

      query += ` ORDER BY l.created_at DESC`;

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM licencas l
         LEFT JOIN assinaturas a ON l.assinatura_id = a.id
         LEFT JOIN clientes c ON a.cliente_id = c.id
         WHERE 1=1 ${search ? `AND (l.license_key ILIKE $1 OR c.nome ILIKE $1 OR c.email ILIKE $1)` : ''}`,
        search ? [`%${search}%`] : []
      );

      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(Number(limit), offset);

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: Number(page),
        limit: Number(limit)
      });
    } catch (error: any) {
      console.error('Error fetching licencas:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch licencas'
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT
          l.*,
          json_build_object(
            'id', a.id,
            'data_inicio', a.data_inicio,
            'data_fim', a.data_fim,
            'cliente', json_build_object(
              'id', c.id,
              'nome', c.nome,
              'email', c.email
            ),
            'plano', json_build_object(
              'id', pl.id,
              'nome', pl.nome
            )
          ) as assinatura
        FROM licencas l
        LEFT JOIN assinaturas a ON l.assinatura_id = a.id
        LEFT JOIN clientes c ON a.cliente_id = c.id
        LEFT JOIN planos pl ON a.plano_id = pl.id
        WHERE l.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Licenca not found'
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error fetching licenca:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch licenca'
      });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const {
        assinatura_id,
        license_key,
        device_fingerprint,
        status = 'ativa',
        max_offline_hours = 168
      } = req.body;

      if (!assinatura_id || !license_key) {
        res.status(400).json({
          success: false,
          error: 'Required fields missing'
        });
        return;
      }

      const result = await pool.query(
        `INSERT INTO licencas (assinatura_id, license_key, device_fingerprint, status, max_offline_hours)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [assinatura_id, license_key, device_fingerprint, status, max_offline_hours]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error creating licenca:', error);

      if (error.code === '23505') {
        res.status(409).json({
          success: false,
          error: 'License key already exists'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create licenca'
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        assinatura_id,
        device_fingerprint,
        status,
        max_offline_hours
      } = req.body;

      const result = await pool.query(
        `UPDATE licencas
         SET assinatura_id = $1, device_fingerprint = $2,
             status = $3, max_offline_hours = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 RETURNING *`,
        [assinatura_id, device_fingerprint, status, max_offline_hours, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Licenca not found'
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error updating licenca:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update licenca'
      });
    }
  }

  async block(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE licencas
         SET status = 'bloqueada', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Licenca not found'
        });
        return;
      }

      // Clear cache to force revalidation
      const license = result.rows[0];
      const { cachePatterns } = await import('../../data/database/config/redis.config');
      const cacheKey = cachePatterns.licenseValidation(license.license_key);
      await redis.del(cacheKey);

      // Log security event
      await pool.query(
        `INSERT INTO security_events (license_key, event_type, severity, risk_score, details, automated_action)
         VALUES ($1, 'license_blocked', 'high', 1.0, $2, 'manual_block')`,
        [license.license_key, { blocked_by: 'admin_panel', license_id: id }]
      );

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Licença bloqueada com sucesso'
      });
    } catch (error: any) {
      console.error('Error blocking licenca:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to block licenca'
      });
    }
  }

  async unblock(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE licencas
         SET status = 'ativa', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Licenca not found'
        });
        return;
      }

      // Clear cache to force revalidation
      const license = result.rows[0];
      const { cachePatterns } = await import('../../data/database/config/redis.config');
      const cacheKey = cachePatterns.licenseValidation(license.license_key);
      await redis.del(cacheKey);

      // Log security event for unblock
      await pool.query(
        `INSERT INTO security_events (license_key, event_type, severity, risk_score, details, automated_action)
         VALUES ($1, 'license_unblocked', 'low', 0.0, $2, 'manual_unblock')`,
        [license.license_key, { unblocked_by: 'admin_panel', license_id: id }]
      );

      // Log audit event
      await pool.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, old_values, new_values)
         VALUES ('license', $1, 'unblock', $2, $3)`,
        [id, { status: 'bloqueada' }, { status: 'ativa' }]
      );

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Licença desbloqueada com sucesso'
      });
    } catch (error: any) {
      console.error('Error unblocking licenca:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unblock licenca'
      });
    }
  }

  async getDevicesByLicenseKey(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey } = req.params;

      const result = await pool.query(
        `SELECT
          ld.id,
          ld.license_key,
          ld.device_fingerprint_id,
          ld.device_name,
          ld.is_active,
          ld.last_seen,
          ld.last_ip,
          ld.reconciled_to_v2_at,
          ld.last_match_source,
          ld.created_at,
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
          ), '[]'::json) as fingerprint_aliases
        FROM license_devices ld
        INNER JOIN device_fingerprints df ON ld.device_fingerprint_id = df.id
        WHERE ld.license_key = $1 AND ld.is_active = TRUE
        ORDER BY ld.last_seen DESC`,
        [licenseKey]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error: any) {
      console.error('Error fetching devices:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch devices'
      });
    }
  }

  async deactivateDeviceByFingerprint(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, fingerprintHash } = req.params;

      // Remover o dispositivo completamente
      const result = await pool.query(
        `WITH target_device AS (
           SELECT ld.id
           FROM license_devices ld
           INNER JOIN device_fingerprints df ON ld.device_fingerprint_id = df.id
           LEFT JOIN license_device_fingerprint_aliases ldfa
             ON ldfa.license_device_id = ld.id
             AND (ldfa.expires_at IS NULL OR ldfa.expires_at > NOW())
           LEFT JOIN device_fingerprints adf ON adf.id = ldfa.device_fingerprint_id
           WHERE ld.license_key = $1
             AND (df.fingerprint_hash = $2 OR adf.fingerprint_hash = $2)
           LIMIT 1
         )
         DELETE FROM license_devices
         WHERE id IN (SELECT id FROM target_device)
         RETURNING *`,
        [licenseKey, fingerprintHash]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Device not found for this license'
        });
        return;
      }

      // Clear cache to force revalidation
      const { cachePatterns } = await import('../../data/database/config/redis.config');
      const cacheKey = cachePatterns.licenseValidation(licenseKey);
      await redis.del(cacheKey);

      // Increment nonce to invalidate all offline tokens for this license
      const nonceKey = `license:nonce:${licenseKey}`;
      await redis.incr(nonceKey);
      await redis.expire(nonceKey, 30 * 24 * 60 * 60); // 30 days

      // Log audit event
      await pool.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, old_values, new_values)
         VALUES ('license_device', $1, 'remove', $2, $3)`,
        [result.rows[0].id, { device_id: result.rows[0].id }, { deleted: true }]
      );

      res.json({
        success: true,
        message: 'Dispositivo removido com sucesso'
      });
    } catch (error: any) {
      console.error('Error removing device:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove device'
      });
    }
  }
}

export const licencasController = new LicencasController();
