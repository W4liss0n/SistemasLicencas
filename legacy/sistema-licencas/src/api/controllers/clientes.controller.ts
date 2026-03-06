import { Request, Response } from 'express';
import pool from '../../data/database/config/postgres.config';
import bcrypt from 'bcrypt';

export class ClientesController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT
          c.id, c.nome, c.email, c.telefone, c.empresa, c.status,
          c.usuario, c.plano_id, c.created_at, c.updated_at,
          p.nome as plano_nome
        FROM clientes c
        LEFT JOIN planos p ON c.plano_id = p.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramCount = 1;

      if (search) {
        query += ` AND (nome ILIKE $${paramCount} OR email ILIKE $${paramCount} OR empresa ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
      }

      query += ` ORDER BY created_at DESC`;

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM clientes WHERE 1=1 ${search ? `AND (nome ILIKE $1 OR email ILIKE $1 OR empresa ILIKE $1)` : ''}`,
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
      console.error('Error fetching clientes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch clientes'
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'SELECT * FROM clientes WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Cliente not found'
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error fetching cliente:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch cliente'
      });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    const client = await pool.connect();
    try {
      const { nome, email, telefone, empresa, status = 'ativo', usuario, senha, plano_id } = req.body;
      const hashedPassword = senha ? await bcrypt.hash(senha, 10) : null;

      console.log('Creating cliente with data:', { nome, email, telefone, empresa, status, usuario, plano_id });

      // Validação: apenas nome é obrigatório
      if (!nome) {
        console.log('Validation failed - missing nome');
        res.status(400).json({
          success: false,
          error: 'Nome is required'
        });
        return;
      }

      // Validação: se usuario for fornecido, senha também deve ser
      if (usuario && !senha) {
        res.status(400).json({
          success: false,
          error: 'Senha is required when usuario is provided'
        });
        return;
      }

      await client.query('BEGIN');

      // Criar cliente
      const clienteResult = await client.query(
        `INSERT INTO clientes (nome, email, telefone, empresa, status, usuario, senha, plano_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [nome, email, telefone, empresa, status, usuario, hashedPassword, plano_id]
      );

      const cliente = clienteResult.rows[0];

      // Se um plano foi selecionado, criar assinatura e licença automaticamente
      if (plano_id) {
        console.log('Plano selecionado, criando assinatura e licença automaticamente...');

        // Buscar informações do plano
        const planoResult = await client.query(
          'SELECT duracao_dias, max_offline_dias FROM planos WHERE id = $1',
          [plano_id]
        );

        if (planoResult.rows.length === 0) {
          throw new Error('Plano não encontrado');
        }

        const plano = planoResult.rows[0];
        const dataInicio = new Date();
        const dataFim = new Date(dataInicio.getTime() + (plano.duracao_dias * 24 * 60 * 60 * 1000));

        // Criar assinatura
        const assinaturaResult = await client.query(
          `INSERT INTO assinaturas (cliente_id, plano_id, data_inicio, data_fim, auto_renovar, status)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [cliente.id, plano_id, dataInicio, dataFim, false, 'ativa']
        );

        const assinatura = assinaturaResult.rows[0];

        // Gerar chave de licença
        const generateLicenseKey = () => {
          const segments = [];
          for (let i = 0; i < 4; i++) {
            const segment = Math.random().toString(36).substring(2, 6).toUpperCase();
            segments.push(segment);
          }
          return `LIC-${segments.join('-')}`;
        };

        const licenseKey = generateLicenseKey();
        const maxOfflineHours = (Number(plano.max_offline_dias) || 7) * 24;

        // Criar licença
        await client.query(
          `INSERT INTO licencas (assinatura_id, license_key, status, max_offline_hours)
           VALUES ($1, $2, 'ativa', $3)`,
          [assinatura.id, licenseKey, maxOfflineHours]
        );

        console.log('Assinatura e licença criadas com sucesso!');
      }

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        data: cliente,
        message: plano_id ? 'Cliente criado com sucesso. Assinatura e licença geradas automaticamente.' : 'Cliente criado com sucesso.'
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Error creating cliente:', error);

      if (error.code === '23505') {
        res.status(409).json({
          success: false,
          error: 'Email already exists'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create cliente'
      });
    } finally {
      client.release();
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { nome, email, telefone, empresa, status, usuario, senha, plano_id } = req.body;
      const hashedPassword = senha ? await bcrypt.hash(senha, 10) : null;

      // Validação: se usuario for fornecido, senha também pode ser atualizada
      // Mas não é obrigatório fornecer senha se usuario já existe

      const result = await pool.query(
        `UPDATE clientes
         SET nome = $1, email = $2, telefone = $3, empresa = $4, status = $5,
             usuario = $6, senha = COALESCE($7, senha), plano_id = $8, updated_at = CURRENT_TIMESTAMP
         WHERE id = $9 RETURNING *`,
        [nome, email, telefone, empresa, status, usuario, hashedPassword, plano_id, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Cliente not found'
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error updating cliente:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update cliente'
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM clientes WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Cliente not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Cliente deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting cliente:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete cliente'
      });
    }
  }
}

export const clientesController = new ClientesController();
