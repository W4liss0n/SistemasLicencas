import { Request, Response } from 'express';
import pool from '../../data/database/config/postgres.config';
import { AuthRequest } from '../middleware/auth.middleware';

export class LogsController {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 25,
        search = '',
        level,
        category,
        date
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT
          id,
          created_at as timestamp,
          action,
          category,
          severity as level,
          user_id,
          user_identifier as user_email,
          ip_address,
          details,
          metadata
        FROM audit_logs
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramCount = 1;

      // Search filter
      if (search) {
        query += ` AND (
          action ILIKE $${paramCount} OR
          user_identifier ILIKE $${paramCount} OR
          category ILIKE $${paramCount}
        )`;
        params.push(`%${search}%`);
        paramCount++;
      }

      // Level filter
      if (level && level !== 'all') {
        query += ` AND severity = $${paramCount}`;
        params.push(level);
        paramCount++;
      }

      // Category filter
      if (category && category !== 'all') {
        query += ` AND category = $${paramCount}`;
        params.push(category);
        paramCount++;
      }

      // Date filter
      if (date) {
        const now = new Date();
        let startDate: Date;

        switch (date) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'yesterday':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            break;
          default:
            startDate = new Date(0); // All time
        }

        if (date !== 'all') {
          query += ` AND created_at >= $${paramCount}`;
          params.push(startDate);
          paramCount++;
        }
      }

      // Get total count
      const countQuery = query.replace(
        'SELECT id,',
        'SELECT COUNT(*) as total FROM (SELECT id'
      ) + ') as subquery';
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0]?.total || '0');

      // Add ordering and pagination
      query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(Number(limit), offset);

      // Execute query
      const result = await pool.query(query, params);

      // Format logs
      const logs = result.rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        level: row.level || 'info',
        category: row.category || 'system',
        action: row.action,
        user_id: row.user_id,
        user_email: row.user_email,
        ip_address: row.ip_address,
        details: row.details,
        metadata: row.metadata
      }));

      res.json({
        success: true,
        data: logs,
        total,
        page: Number(page),
        limit: Number(limit)
      });
    } catch (error) {
      console.error('Error getting logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get logs'
      });
    }
  }

  async getCategories(req: AuthRequest, res: Response): Promise<void> {
    try {
      const query = `
        SELECT DISTINCT category
        FROM audit_logs
        WHERE category IS NOT NULL
        ORDER BY category
      `;

      const result = await pool.query(query);
      const categories = result.rows.map(row => row.category);

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error getting categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get categories'
      });
    }
  }
}

export const logsController = new LogsController();