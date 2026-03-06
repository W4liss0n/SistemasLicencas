import { Request, Response } from 'express';
import pool from '../../data/database/config/postgres.config';
import { LicenseService } from '../../core/license/services/license.service';

export class AssinaturasController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT
          a.*,
          json_build_object(
            'id', c.id,
            'nome', c.nome,
            'email', c.email,
            'empresa', c.empresa,
            'status', c.status
          ) as cliente,
          json_build_object(
            'id', p.id,
            'nome', p.nome,
            'preco', p.preco,
            'duracao_dias', p.duracao_dias,
            'max_dispositivos', p.max_dispositivos,
            'max_offline_dias', p.max_offline_dias,
            'programas', (
              SELECT json_agg(
                json_build_object(
                  'id', prog.id,
                  'nome', prog.nome,
                  'versao', prog.versao
                )
              )
              FROM plano_programas pp
              JOIN programas prog ON pp.programa_id = prog.id
              WHERE pp.plano_id = p.id
            )
          ) as plano
        FROM assinaturas a
        LEFT JOIN clientes c ON a.cliente_id = c.id
        LEFT JOIN planos p ON a.plano_id = p.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramCount = 1;

      if (search) {
        query += ` AND (c.nome ILIKE $${paramCount} OR c.email ILIKE $${paramCount} OR p.nome ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
      }

      query += ` ORDER BY a.created_at DESC`;

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM assinaturas a
         LEFT JOIN clientes c ON a.cliente_id = c.id
         LEFT JOIN planos p ON a.plano_id = p.id
         WHERE 1=1 ${search ? `AND (c.nome ILIKE $1 OR c.email ILIKE $1 OR p.nome ILIKE $1)` : ''}`,
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
      console.error('Error fetching assinaturas:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch assinaturas'
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT
          a.*,
          json_build_object(
            'id', c.id,
            'nome', c.nome,
            'email', c.email,
            'empresa', c.empresa
          ) as cliente,
          json_build_object(
            'id', p.id,
            'nome', p.nome,
            'preco', p.preco,
            'duracao_dias', p.duracao_dias,
            'programas', (
              SELECT json_agg(
                json_build_object(
                  'id', prog.id,
                  'nome', prog.nome,
                  'versao', prog.versao
                )
              )
              FROM plano_programas pp
              JOIN programas prog ON pp.programa_id = prog.id
              WHERE pp.plano_id = p.id
            )
          ) as plano
        FROM assinaturas a
        LEFT JOIN clientes c ON a.cliente_id = c.id
        LEFT JOIN planos p ON a.plano_id = p.id
        WHERE a.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Assinatura not found'
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error fetching assinatura:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch assinatura'
      });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();
    try {
      const {
        cliente_id,
        plano_id,
        data_inicio,
        data_fim,
        auto_renovar = false,
        status = 'ativa'
      } = req.body;

      if (!cliente_id || !plano_id || !data_inicio || !data_fim) {
        res.status(400).json({
          success: false,
          error: 'Required fields missing'
        });
        return;
      }

      await client.query('BEGIN');

      // Criar assinatura
      const assinaturaResult = await client.query(
        `INSERT INTO assinaturas (cliente_id, plano_id, data_inicio, data_fim, auto_renovar, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [cliente_id, plano_id, data_inicio, data_fim, auto_renovar, status]
      );

      const assinatura = assinaturaResult.rows[0];

      // Gerar licença automaticamente para a assinatura (uma licença por assinatura)
      const generateLicenseKey = () => {
        const segments = [];
        for (let i = 0; i < 4; i++) {
          const segment = Math.random().toString(36).substring(2, 6).toUpperCase();
          segments.push(segment);
        }
        return `LIC-${segments.join('-')}`;
      };

      const licenseKey = generateLicenseKey();

      // Buscar max_offline_dias do plano
      const planoResult = await client.query(
        'SELECT max_offline_dias FROM planos WHERE id = $1',
        [plano_id]
      );
      const maxOfflineHours = (Number(planoResult.rows[0]?.max_offline_dias) || 7) * 24;

      // Criar licença única para a assinatura
      await client.query(
        `INSERT INTO licencas (assinatura_id, license_key, status, max_offline_hours)
         VALUES ($1, $2, 'ativa', $3)`,
        [assinatura.id, licenseKey, maxOfflineHours]
      );

      await client.query('COMMIT');

      // Buscar assinatura completa com plano e cliente
      const completeResult = await client.query(
        `SELECT
          a.*,
          json_build_object(
            'id', c.id,
            'nome', c.nome,
            'email', c.email,
            'empresa', c.empresa
          ) as cliente,
          json_build_object(
            'id', p.id,
            'nome', p.nome,
            'preco', p.preco,
            'duracao_dias', p.duracao_dias,
            'programas', (
              SELECT json_agg(
                json_build_object(
                  'id', prog.id,
                  'nome', prog.nome,
                  'versao', prog.versao
                )
              )
              FROM plano_programas pp
              JOIN programas prog ON pp.programa_id = prog.id
              WHERE pp.plano_id = p.id
            )
          ) as plano
        FROM assinaturas a
        LEFT JOIN clientes c ON a.cliente_id = c.id
        LEFT JOIN planos p ON a.plano_id = p.id
        WHERE a.id = $1`,
        [assinatura.id]
      );

      res.status(201).json({
        success: true,
        data: completeResult.rows[0],
        message: 'Assinatura criada com sucesso. Licença gerada automaticamente.'
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Error creating assinatura:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create assinatura'
      });
    } finally {
      client.release();
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        cliente_id,
        plano_id,
        data_inicio,
        data_fim,
        auto_renovar,
        status
      } = req.body;

      // Get current subscription to check if plan changed
      const currentSubResult = await pool.query(
        `SELECT a.plano_id, p.max_dispositivos as old_max_dispositivos
         FROM assinaturas a
         LEFT JOIN planos p ON a.plano_id = p.id
         WHERE a.id = $1`,
        [id]
      );

      if (currentSubResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Assinatura not found'
        });
        return;
      }

      const currentSub = currentSubResult.rows[0];
      const oldPlanId = currentSub.plano_id;
      const oldMaxDevices = currentSub.old_max_dispositivos || 1;

      // Update subscription
      const result = await pool.query(
        `UPDATE assinaturas
         SET cliente_id = $1, plano_id = $2, data_inicio = $3, data_fim = $4,
             auto_renovar = $5, status = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 RETURNING *`,
        [cliente_id, plano_id, data_inicio, data_fim, auto_renovar, status, id]
      );

      // Check if plan changed
      if (plano_id && plano_id !== oldPlanId) {
        // Get new plan's max_dispositivos
        const newPlanResult = await pool.query(
          'SELECT max_dispositivos FROM planos WHERE id = $1',
          [plano_id]
        );

        if (newPlanResult.rows.length > 0) {
          const newMaxDevices = newPlanResult.rows[0].max_dispositivos || 1;

          // Handle plan change (deactivates all devices if downgraded)
          await LicenseService.handlePlanChange(id, newMaxDevices, oldMaxDevices);

          console.log(`[PLAN_CHANGE] Plan changed from ${oldMaxDevices} to ${newMaxDevices} devices for subscription ${id}`);
        }
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error updating assinatura:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update assinatura'
      });
    }
  }

  async cancel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE assinaturas
         SET status = 'cancelada', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Assinatura not found'
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error canceling assinatura:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel assinatura'
      });
    }
  }
}

export const assinaturasController = new AssinaturasController();