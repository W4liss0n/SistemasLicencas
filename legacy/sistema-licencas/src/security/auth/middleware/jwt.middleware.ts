import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../services/jwt.service';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
    type: 'client' | 'admin' | 'api';
  };
}

/**
 * JWT authentication middleware
 */
export const authenticateJWT = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'No authorization header provided'
      });
    }

    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) {
      return res.status(401).json({
        error: 'Invalid authorization header format'
      });
    }

    const payload = JWTService.verifyAccessToken(token);
    req.user = payload;

    next();
  } catch (error: any) {
    if (error.message === 'Token expired') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.message === 'Invalid token') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(401).json({
      error: 'Authentication failed'
    });
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    if (roles.length > 0 && !roles.includes(req.user.role || '')) {
      return res.status(403).json({
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Optional JWT authentication (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const [bearer, token] = authHeader.split(' ');

      if (bearer === 'Bearer' && token) {
        try {
          const payload = JWTService.verifyAccessToken(token);
          req.user = payload;
        } catch (error) {
          // Ignore token errors in optional auth
        }
      }
    }

    next();
  } catch (error) {
    next();
  }
};