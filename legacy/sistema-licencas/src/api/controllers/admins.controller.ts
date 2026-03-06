import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../../data/database/config/postgres.config';
import { AuthRequest } from '../middleware/auth.middleware';
import { v4 as uuidv4 } from 'uuid';

export class AdminsController {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT
          id,
          username,
          email,
          name,
          role,
          is_active as status,
          last_login,
          created_at,
          updated_at
        FROM users
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramCount = 1;

      if (search) {
        query += ` AND (
          username ILIKE $${paramCount} OR
          email ILIKE $${paramCount} OR
          name ILIKE $${paramCount}
        )`;
        params.push(`%${search}%`);
        paramCount++;
      }

      // Get total count
      const countQuery = query.replace(
        /SELECT\s+id,[\s\S]*?FROM users/,
        'SELECT COUNT(*) as total FROM users'
      );
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0]?.total || '0');

      // Get paginated results
      query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(Number(limit), offset);

      const result = await pool.query(query, params);

      // Format the response
      const admins = result.rows.map(row => ({
        id: row.id,
        username: row.username,
        email: row.email,
        name: row.name,
        role: row.role,
        status: row.status ? 'ativo' : 'inativo',
        last_login: row.last_login,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

      res.json({
        success: true,
        data: admins,
        total,
        page: Number(page),
        limit: Number(limit)
      });
    } catch (error) {
      console.error('Error getting admins:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get administrators'
      });
    }
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const query = `
        SELECT
          id,
          username,
          email,
          name,
          role,
          is_active as status,
          last_login,
          created_at,
          updated_at
        FROM users
        WHERE id = $1
      `;

      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Administrator not found'
        });
        return;
      }

      const admin = result.rows[0];
      res.json({
        success: true,
        data: {
          ...admin,
          status: admin.status ? 'ativo' : 'inativo'
        }
      });
    } catch (error) {
      console.error('Error getting admin:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get administrator'
      });
    }
  }

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { username, password, email, name, status = 'ativo' } = req.body;

      // Validate required fields
      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
        return;
      }

      // Check if username already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE username = $1 OR (email = $2 AND email IS NOT NULL)',
        [username, email || null]
      );

      if (existingUser.rows.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Username or email already exists'
        });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Insert new admin
      const query = `
        INSERT INTO users (
          id, username, password_hash, email, name, role, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7
        ) RETURNING id, username, email, name, role, is_active as status, created_at
      `;

      const result = await pool.query(query, [
        uuidv4(),
        username,
        passwordHash,
        email || null,
        name || username,
        'admin',
        status === 'ativo'
      ]);

      res.status(201).json({
        success: true,
        data: {
          ...result.rows[0],
          status: result.rows[0].status ? 'ativo' : 'inativo'
        }
      });
    } catch (error) {
      console.error('Error creating admin:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create administrator'
      });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { username, email, name, status, password } = req.body;

      // Check if admin exists
      const existing = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Administrator not found'
        });
        return;
      }

      // Build update query dynamically
      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (username !== undefined) {
        updates.push(`username = $${paramCount}`);
        params.push(username);
        paramCount++;
      }

      if (email !== undefined) {
        updates.push(`email = $${paramCount}`);
        params.push(email || null);
        paramCount++;
      }

      if (name !== undefined) {
        updates.push(`name = $${paramCount}`);
        params.push(name);
        paramCount++;
      }

      if (status !== undefined) {
        updates.push(`is_active = $${paramCount}`);
        params.push(status === 'ativo');
        paramCount++;
      }

      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        updates.push(`password_hash = $${paramCount}`);
        params.push(passwordHash);
        paramCount++;
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
        return;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const query = `
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, username, email, name, role, is_active as status, updated_at
      `;

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: {
          ...result.rows[0],
          status: result.rows[0].status ? 'ativo' : 'inativo'
        }
      });
    } catch (error) {
      console.error('Error updating admin:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update administrator'
      });
    }
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if admin exists
      const admin = await pool.query(
        'SELECT is_active, role FROM users WHERE id = $1',
        [id]
      );

      if (admin.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Administrator not found'
        });
        return;
      }

      // Don't allow deleting the last active admin
      if (admin.rows[0].is_active) {
        const adminCount = await pool.query(
          'SELECT COUNT(*) as count FROM users WHERE role = $1 AND is_active = true',
          ['admin']
        );

        if (adminCount.rows[0].count <= 1) {
          res.status(400).json({
            success: false,
            error: 'Cannot delete the last active administrator'
          });
          return;
        }
      }

      // Hard delete - permanently remove from database
      await pool.query(
        'DELETE FROM users WHERE id = $1',
        [id]
      );

      res.json({
        success: true,
        message: 'Administrator permanently deleted'
      });
    } catch (error) {
      console.error('Error deleting admin:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete administrator'
      });
    }
  }

  async resetPassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if admin exists
      const existing = await pool.query(
        'SELECT username, email FROM users WHERE id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Administrator not found'
        });
        return;
      }

      // Generate temporary password (8 characters)
      const temporaryPassword = Math.random().toString(36).substring(2, 10).toUpperCase();

      // Hash and update password
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);

      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [passwordHash, id]
      );

      res.json({
        success: true,
        temporaryPassword,
        message: 'Password reset successfully. Please save the temporary password.'
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset password'
      });
    }
  }
}

export const adminsController = new AdminsController();