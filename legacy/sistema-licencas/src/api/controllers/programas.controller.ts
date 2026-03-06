import { Request, Response } from 'express';
import pool from '../../data/database/config/postgres.config';

export class ProgramasController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT
          id, nome, descricao, versao, executable_hash, status, created_at, updated_at
        FROM programas
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramCount = 1;

      if (search) {
        query += ` AND (nome ILIKE $${paramCount} OR descricao ILIKE $${paramCount} OR versao ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
      }

      query += ` ORDER BY created_at DESC`;

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM programas WHERE 1=1 ${search ? `AND (nome ILIKE $1 OR descricao ILIKE $1 OR versao ILIKE $1)` : ''}`,
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
      console.error('Error fetching programas:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch programas'
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'SELECT * FROM programas WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Programa not found'
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error fetching programa:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch programa'
      });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { nome, descricao, versao, executable_hash, status = 'ativo' } = req.body;

      if (!nome) {
        res.status(400).json({
          success: false,
          error: 'Nome é obrigatório'
        });
        return;
      }

      const result = await pool.query(
        `INSERT INTO programas (nome, descricao, versao, executable_hash, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [nome, descricao, versao, executable_hash, status]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error creating programa:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create programa'
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { nome, descricao, versao, executable_hash, status } = req.body;

      const existsResult = await pool.query(
        'SELECT id FROM programas WHERE id = $1',
        [id]
      );

      if (existsResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Programa not found'
        });
        return;
      }

      const fields = [];
      const values = [];
      let paramCount = 1;

      if (nome !== undefined) {
        fields.push(`nome = $${paramCount}`);
        values.push(nome);
        paramCount++;
      }

      if (descricao !== undefined) {
        fields.push(`descricao = $${paramCount}`);
        values.push(descricao);
        paramCount++;
      }

      if (versao !== undefined) {
        fields.push(`versao = $${paramCount}`);
        values.push(versao);
        paramCount++;
      }

      if (executable_hash !== undefined) {
        fields.push(`executable_hash = $${paramCount}`);
        values.push(executable_hash);
        paramCount++;
      }

      if (status !== undefined) {
        fields.push(`status = $${paramCount}`);
        values.push(status);
        paramCount++;
      }

      if (fields.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
        return;
      }

      values.push(id);
      const updateQuery = `
        UPDATE programas
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(updateQuery, values);

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error updating programa:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update programa'
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM programas WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Programa not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Programa deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting programa:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete programa'
      });
    }
  }
}

export const programasController = new ProgramasController();