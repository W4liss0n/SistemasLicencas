import { Request, Response } from 'express';
import { authService } from '../../core/auth/services/auth.service';
import { auditLogService } from '../../core/audit/services/audit-log.service';
import { AuthRequest } from '../middleware/auth.middleware';

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, username, userOrEmail } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      // Accept userOrEmail field or separate email/username
      const loginValue = userOrEmail || email || username;

      if (!loginValue || !password) {
        res.status(400).json({ error: 'Username/email and password are required' });
        return;
      }

      const authResponse = await authService.login({
        userOrEmail: loginValue,
        password
      });

      // Log successful login
      await auditLogService.logLogin(
        authResponse.user.id,
        authResponse.user.email,
        true,
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        token: authResponse.token,
        user: authResponse.user
      });
    } catch (error: any) {
      console.error('Login error:', error);

      // Log failed login attempt
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      await auditLogService.logLogin(
        '',
        req.body.email || '',
        false,
        ipAddress,
        userAgent
      );

      res.status(401).json({
        success: false,
        error: error.message || 'Authentication failed'
      });
    }
  }

  async me(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await authService.getUserById(req.user.id);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        success: true,
        user
      });
    } catch (error: any) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user information'
      });
    }
  }

  async verify(req: AuthRequest, res: Response): Promise<void> {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        res.status(401).json({ success: false, error: 'No token provided' });
        return;
      }

      const user = await authService.verifyToken(token);

      res.json({
        success: true,
        valid: true,
        user
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        valid: false,
        error: 'Invalid token'
      });
    }
  }
}

export const authController = new AuthController();