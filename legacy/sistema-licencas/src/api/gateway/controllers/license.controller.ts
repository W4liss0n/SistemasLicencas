import { Request, Response, NextFunction } from 'express';
import { LicenseService } from '../../../core/license/services/license.service';
import { auditLogService } from '../../../core/audit/services/audit-log.service';
import { ILicenseValidationRequest } from '../../../shared/interfaces/license.interface';
import pool from '../../../data/database/config/postgres.config';
import { getErrorMessage } from '../../../shared/constants/error-messages';
import bcrypt from 'bcrypt';

export class LicenseController {
  /**
   * Validate a license
   */
  static async validateLicense(req: Request, res: Response, next: NextFunction) {
    try {
      const validationRequest: ILicenseValidationRequest = req.body;

      // Get program ID from header
      const programId = req.headers['x-program-id'] as string;
      if (programId) {
        validationRequest.program_id = programId;
      }

      // Add IP address from request
      const clientIp = req.ip || req.socket.remoteAddress || '0.0.0.0';

      const result = await LicenseService.validateLicense(validationRequest, clientIp);

      // Log license validation
      await auditLogService.logLicenseValidation(
        validationRequest.license_key,
        validationRequest.program_id || '',
        result.valid,
        clientIp,
        {
          device_fingerprint: validationRequest.device_fingerprint,
          program_version: validationRequest.program_version,
          os_info: validationRequest.os_info
        }
      );

      // Se a validação foi bem-sucedida, buscar os dados do cliente
      if (result.valid) {
        try {
          const clientResult = await pool.query(
            `SELECT c.id, c.usuario, c.nome, c.email, p.nome as plano_nome
             FROM licencas l
             INNER JOIN assinaturas a ON l.assinatura_id = a.id
             INNER JOIN clientes c ON a.cliente_id = c.id
             LEFT JOIN planos p ON c.plano_id = p.id
             WHERE l.license_key = $1`,
            [validationRequest.license_key]
          );

          if (clientResult.rows.length > 0) {
            const cliente = clientResult.rows[0];
            res.json({
              ...result,
              client: {
                username: cliente.usuario,
                usuario: cliente.usuario,
                nome: cliente.nome,
                email: cliente.email,
                plano: cliente.plano_nome
              }
            });
            return;
          }
        } catch (clientError) {
          console.error('Error fetching client data:', clientError);
          // Continua mesmo se falhar ao buscar dados do cliente
        }
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Activate a license
   */
  static async activateLicense(req: Request, res: Response, next: NextFunction) {
    try {
      const { license_key, device_fingerprint } = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || '0.0.0.0';

      // Get program ID from header
      const programId = req.headers['x-program-id'] as string;

      // For now, activation is same as validation with fingerprint storage
      const result = await LicenseService.validateLicense({
        license_key,
        device_fingerprint,
        program_id: programId,
        program_version: req.body.program_version || '1.0.0',
        os_info: req.body.os_info || 'Unknown'
      }, clientIp);

      res.json({
        success: result.valid,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send heartbeat
   */
  static async heartbeat(req: Request, res: Response, next: NextFunction) {
    try {
      const { license_key } = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || '0.0.0.0';
      const programId = req.headers['x-program-id'] as string;

      // Record heartbeat (simplified for now)
      const result = await LicenseService.validateLicense({
        license_key,
        device_fingerprint: req.body.device_fingerprint,
        program_id: programId,
        program_version: req.body.program_version || '1.0.0',
        os_info: req.body.os_info || 'Unknown'
      }, clientIp);

      res.json({
        success: result.valid,
        next_heartbeat: 3600, // Next heartbeat in 1 hour
        server_time: Date.now()
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deactivate a license from current device (not block, just remove fingerprint)
   */
  static async deactivateLicense(req: Request, res: Response, next: NextFunction) {
    try {
      const { license_key, device_fingerprint } = req.body;

      // Clear fingerprint instead of blocking
      await LicenseService.clearDeviceFingerprint(license_key, device_fingerprint);

      res.json({
        success: true,
        message: 'Device deactivated successfully. License remains valid for use on another device.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Transfer license to new device
   */
  static async transferLicense(req: Request, res: Response, next: NextFunction) {
    try {
      const { license_key, new_device_fingerprint } = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || '0.0.0.0';

      const result = await LicenseService.transferLicense(
        license_key,
        new_device_fingerprint,
        clientIp
      );

      res.json({
        success: true,
        message: 'License transferred successfully',
        ...result
      });
    } catch (error: any) {
      // Handle transfer limit error specially
      if (error.message.includes('Monthly transfer limit')) {
        res.status(429).json({
          success: false,
          error: 'transfer_limit_exceeded',
          message: error.message
        });
      } else {
        next(error);
      }
    }
  }

  /**
   * Authenticate client with username/email and password
   * Returns license key if authentication is successful
   */
  static async authenticateClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password, device_fingerprint, program_version, os_info } = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || '0.0.0.0';
      const programId = req.headers['x-program-id'] as string;

      // Validação básica
      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: 'invalid_credentials',
          message: getErrorMessage('invalid_credentials')
        });
        return;
      }

      if (!device_fingerprint) {
        res.status(400).json({
          success: false,
          error: 'invalid_request',
          message: getErrorMessage('invalid_request')
        });
        return;
      }

      // Buscar cliente por email ou usuario
      const clientResult = await pool.query(
        `SELECT c.*, p.nome as plano_nome
         FROM clientes c
         LEFT JOIN planos p ON c.plano_id = p.id
         WHERE (c.email = $1 OR c.usuario = $1) AND c.status = 'ativo'
         LIMIT 1`,
        [username]
      );

      if (clientResult.rows.length === 0) {
        // Log failed authentication attempt
        await auditLogService.logEvent('authentication_failed', 'client', null, {
          username,
          ip: clientIp,
          reason: 'Invalid credentials'
        });

        res.status(401).json({
          success: false,
          error: 'invalid_credentials',
          message: getErrorMessage('invalid_credentials')
        });
        return;
      }

      const cliente = clientResult.rows[0];
      let passwordMatches = false;

      if (cliente.senha) {
        try {
          // Try bcrypt (expected)
          passwordMatches = await bcrypt.compare(password, cliente.senha);

          // Legacy plaintext support: if bcrypt fails but stored equals plain, rehash
          if (!passwordMatches && cliente.senha === password) {
            const newHash = await bcrypt.hash(password, 10);
            await pool.query(
              'UPDATE clientes SET senha = $1 WHERE id = $2',
              [newHash, cliente.id]
            );
            cliente.senha = newHash;
            passwordMatches = true;
          }
        } catch (compareError) {
          console.error('Error comparing client password:', compareError);
        }
      }

      if (!passwordMatches) {
        await auditLogService.logEvent('authentication_failed', 'client', cliente.id, {
          username,
          ip: clientIp,
          reason: 'Invalid credentials'
        });

        res.status(401).json({
          success: false,
          error: 'invalid_credentials',
          message: getErrorMessage('invalid_credentials')
        });
        return;
      }

      // Buscar assinatura ativa do cliente
      const assinaturaResult = await pool.query(
        `SELECT a.*, l.license_key, l.id as license_id, l.status as license_status
         FROM assinaturas a
         INNER JOIN licencas l ON a.id = l.assinatura_id
         WHERE a.cliente_id = $1 AND a.status = 'ativa' AND l.status IN ('ativa', 'inativa')
         ORDER BY a.created_at DESC
         LIMIT 1`,
        [cliente.id]
      );

      if (assinaturaResult.rows.length === 0) {
        // Log failed authentication - no active subscription
        await auditLogService.logEvent('authentication_failed', 'client', cliente.id, {
          username,
          ip: clientIp,
          reason: 'No active subscription'
        });

        res.status(403).json({
          success: false,
          error: 'no_active_subscription',
          message: getErrorMessage('no_active_subscription')
        });
        return;
      }

      const assinatura = assinaturaResult.rows[0];
      const licenseKey = assinatura.license_key;

      // Validar a licença com o dispositivo
      const validationResult = await LicenseService.validateLicense({
        license_key: licenseKey,
        device_fingerprint,
        program_id: programId,
        program_version: program_version || '1.0.0',
        os_info: os_info || 'Unknown'
      }, clientIp);

      if (validationResult.valid) {
        // Log successful authentication
        await auditLogService.logEvent('authentication_success', 'client', cliente.id, {
          username,
          ip: clientIp,
          license_key: licenseKey.substring(0, 8) + '...'
        });

        // Retornar sucesso com license_key e dados de validação
        res.json({
          success: true,
          authenticated: true,
          license_key: licenseKey,
          client: {
            id: cliente.id,
            usuario: cliente.usuario,
            nome: cliente.nome,
            email: cliente.email,
            plano: cliente.plano_nome
          },
          ...validationResult
        });
        return;
      } else {
        // Licença encontrada mas validação falhou
        await auditLogService.logEvent('authentication_failed', 'client', cliente.id, {
          username,
          ip: clientIp,
          license_key: licenseKey.substring(0, 8) + '...',
          reason: validationResult.reason || 'License validation failed'
        });

        res.status(403).json({
          success: false,
          error: validationResult.error || 'validation_failed',
          reason: validationResult.reason,
          message: validationResult.message || getErrorMessage('validation_failed')
        });
        return;
      }
    } catch (error) {
      console.error('Authentication error:', error);
      next(error);
    }
  }
}
