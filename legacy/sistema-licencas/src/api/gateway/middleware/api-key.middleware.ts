import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../../../data/database/config/postgres.config';

interface ApiKeyRequest extends Request {
  apiKey?: {
    id: string;
    programa_id: string;
    nome: string;
    permissoes: any;
  };
}

export const apiKeyAuth = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const programId = req.headers['x-program-id'] as string;

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        code: 'API_KEY_MISSING'
      });
    }

    if (!programId) {
      return res.status(401).json({
        error: 'Program ID required',
        code: 'PROGRAM_ID_MISSING'
      });
    }

    // Hash the API key for comparison
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    // Validate API key in database
    const result = await query(
      `SELECT * FROM api_keys
       WHERE key_hash = $1
         AND programa_id = $2
         AND status = 'ativa'
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [keyHash, programId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }

    const apiKeyData = result.rows[0];

    // Update last use timestamp
    await query(
      'UPDATE api_keys SET ultimo_uso = NOW() WHERE id = $1',
      [apiKeyData.id]
    );

    // Attach API key data to request
    req.apiKey = {
      id: apiKeyData.id,
      programa_id: apiKeyData.programa_id,
      nome: apiKeyData.nome,
      permissoes: apiKeyData.permissoes
    };

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};