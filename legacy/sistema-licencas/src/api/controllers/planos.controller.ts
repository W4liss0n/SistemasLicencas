import { Request, Response } from 'express';
import pool from '../../data/database/config/postgres.config';
import { LicenseService } from '../../core/license/services/license.service';

class PlanosController {
  async getAll(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT
          p.*,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', prog.id,
                'nome', prog.nome,
                'descricao', prog.descricao,
                'versao', prog.versao
              )
            ) FILTER (WHERE prog.id IS NOT NULL),
            '[]'::json
          ) as programas
        FROM planos p
        LEFT JOIN plano_programas pp ON p.id = pp.plano_id
        LEFT JOIN programas prog ON pp.programa_id = prog.id
      `;

      const queryParams: any[] = [];

      if (search) {
        query += ` WHERE p.nome ILIKE $1 OR p.descricao ILIKE $1`;
        queryParams.push(`%${search}%`);
      }

      query += ` GROUP BY p.id ORDER BY p.created_at DESC`;

      const countQuery = search
        ? `SELECT COUNT(*) FROM planos WHERE nome ILIKE $1 OR descricao ILIKE $1`
        : `SELECT COUNT(*) FROM planos`;

      const [countResult, planosResult] = await Promise.all([
        pool.query(countQuery, search ? [`%${search}%`] : []),
        pool.query(query + ` LIMIT ${limit} OFFSET ${offset}`, queryParams)
      ]);

      res.json({
        data: planosResult.rows,
        total: parseInt(countResult.rows[0].count),
        page: Number(page),
        limit: Number(limit)
      });
    } catch (error) {
      console.error('Error fetching planos:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const query = `
        SELECT
          p.*,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', prog.id,
                'nome', prog.nome,
                'descricao', prog.descricao,
                'versao', prog.versao
              )
            ) FILTER (WHERE prog.id IS NOT NULL),
            '[]'::json
          ) as programas
        FROM planos p
        LEFT JOIN plano_programas pp ON p.id = pp.plano_id
        LEFT JOIN programas prog ON pp.programa_id = prog.id
        WHERE p.id = $1
        GROUP BY p.id
      `;

      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Plano not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching plano:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async create(req: Request, res: Response) {
    const client = await pool.connect();
    try {
      const {
        nome,
        descricao,
        preco,
        duracao_dias,
        max_offline_dias,
        max_dispositivos,
        status,
        programas_ids = []
      } = req.body;

      await client.query('BEGIN');

      // Criar o plano
      const planoQuery = `
        INSERT INTO planos (
          nome, descricao, preco, duracao_dias,
          max_offline_dias, max_dispositivos, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const planoResult = await client.query(planoQuery, [
        nome,
        descricao,
        preco,
        duracao_dias,
        max_offline_dias,
        max_dispositivos || 1,
        status || 'ativo'
      ]);

      const plano = planoResult.rows[0];

      // Adicionar programas ao plano
      if (programas_ids.length > 0) {
        const values = programas_ids.map((programa_id: string) =>
          `('${plano.id}', '${programa_id}')`
        ).join(',');

        await client.query(`
          INSERT INTO plano_programas (plano_id, programa_id)
          VALUES ${values}
        `);
      }

      await client.query('COMMIT');

      // Buscar plano completo com programas
      const completeQuery = `
        SELECT
          p.*,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', prog.id,
                'nome', prog.nome,
                'descricao', prog.descricao,
                'versao', prog.versao
              )
            ) FILTER (WHERE prog.id IS NOT NULL),
            '[]'::json
          ) as programas
        FROM planos p
        LEFT JOIN plano_programas pp ON p.id = pp.plano_id
        LEFT JOIN programas prog ON pp.programa_id = prog.id
        WHERE p.id = $1
        GROUP BY p.id
      `;

      const completeResult = await client.query(completeQuery, [plano.id]);

      res.status(201).json(completeResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating plano:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }

  async update(req: Request, res: Response) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const {
        nome,
        descricao,
        preco,
        duracao_dias,
        max_offline_dias,
        max_dispositivos,
        status,
        programas_ids = []
      } = req.body;

      await client.query('BEGIN');

      // Get current plan to check if max_dispositivos changed
      const currentPlanResult = await client.query(
        'SELECT max_dispositivos FROM planos WHERE id = $1',
        [id]
      );

      if (currentPlanResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Plano not found' });
      }

      const oldMaxDevices = currentPlanResult.rows[0].max_dispositivos || 1;
      const newMaxDevices = max_dispositivos || 1;

      // Atualizar o plano
      const updateQuery = `
        UPDATE planos SET
          nome = $1,
          descricao = $2,
          preco = $3,
          duracao_dias = $4,
          max_offline_dias = $5,
          max_dispositivos = $6,
          status = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [
        nome,
        descricao,
        preco,
        duracao_dias,
        max_offline_dias,
        max_dispositivos,
        status,
        id
      ]);

      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Plano not found' });
      }

      // CRITICAL: If max_dispositivos was reduced, deactivate all devices for all subscriptions using this plan
      if (newMaxDevices < oldMaxDevices) {
        console.log(`[PLAN_UPDATE] Plan ${nome} downgraded from ${oldMaxDevices} to ${newMaxDevices} devices`);

        // Get all active subscriptions using this plan
        const subscriptionsResult = await client.query(
          'SELECT id FROM assinaturas WHERE plano_id = $1 AND status = $2',
          [id, 'ativa']
        );

        const subscriptions = subscriptionsResult.rows;

        // Deactivate all devices for each subscription
        for (const subscription of subscriptions) {
          await LicenseService.handlePlanChange(subscription.id, newMaxDevices, oldMaxDevices);
        }

        console.log(`[PLAN_UPDATE] Processed ${subscriptions.length} subscription(s) affected by plan downgrade`);
      }

      // Remover programas antigos
      await client.query('DELETE FROM plano_programas WHERE plano_id = $1', [id]);

      // Adicionar novos programas
      if (programas_ids.length > 0) {
        const values = programas_ids.map((programa_id: string) =>
          `('${id}', '${programa_id}')`
        ).join(',');

        await client.query(`
          INSERT INTO plano_programas (plano_id, programa_id)
          VALUES ${values}
        `);
      }

      await client.query('COMMIT');

      // Buscar plano completo com programas
      const completeQuery = `
        SELECT
          p.*,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', prog.id,
                'nome', prog.nome,
                'descricao', prog.descricao,
                'versao', prog.versao
              )
            ) FILTER (WHERE prog.id IS NOT NULL),
            '[]'::json
          ) as programas
        FROM planos p
        LEFT JOIN plano_programas pp ON p.id = pp.plano_id
        LEFT JOIN programas prog ON pp.programa_id = prog.id
        WHERE p.id = $1
        GROUP BY p.id
      `;

      const completeResult = await client.query(completeQuery, [id]);

      res.json(completeResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating plano:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Verificar se há assinaturas usando este plano
      const checkQuery = `
        SELECT COUNT(*) FROM assinaturas
        WHERE plano_id = $1 AND status = 'ativa'
      `;
      const checkResult = await pool.query(checkQuery, [id]);

      if (parseInt(checkResult.rows[0].count) > 0) {
        return res.status(400).json({
          error: 'Cannot delete plano with active subscriptions'
        });
      }

      const deleteQuery = 'DELETE FROM planos WHERE id = $1 RETURNING *';
      const result = await pool.query(deleteQuery, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Plano not found' });
      }

      res.json({ message: 'Plano deleted successfully' });
    } catch (error) {
      console.error('Error deleting plano:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getProgramas(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const query = `
        SELECT prog.*
        FROM programas prog
        JOIN plano_programas pp ON prog.id = pp.programa_id
        WHERE pp.plano_id = $1
        ORDER BY prog.nome
      `;

      const result = await pool.query(query, [id]);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching plano programas:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async addPrograma(req: Request, res: Response) {
    try {
      const { id: plano_id } = req.params;
      const { programa_id } = req.body;

      const query = `
        INSERT INTO plano_programas (plano_id, programa_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        RETURNING *
      `;

      const result = await pool.query(query, [plano_id, programa_id]);

      if (result.rows.length === 0) {
        return res.status(409).json({ error: 'Programa already in plano' });
      }

      res.status(201).json({ message: 'Programa added to plano' });
    } catch (error) {
      console.error('Error adding programa to plano:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async removePrograma(req: Request, res: Response) {
    try {
      const { id: plano_id, programaId: programa_id } = req.params;

      const query = `
        DELETE FROM plano_programas
        WHERE plano_id = $1 AND programa_id = $2
        RETURNING *
      `;

      const result = await pool.query(query, [plano_id, programa_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Programa not found in plano' });
      }

      res.json({ message: 'Programa removed from plano' });
    } catch (error) {
      console.error('Error removing programa from plano:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const planosController = new PlanosController();