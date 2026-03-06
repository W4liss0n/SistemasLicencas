import { Request, Response } from 'express';
import pool from '../../data/database/config/postgres.config';

export class DashboardController {
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const [clientesResult, assinaturasResult, licencasResult] = await Promise.all([
        pool.query('SELECT COUNT(*) as total FROM clientes WHERE status = $1', ['ativo']),
        pool.query('SELECT COUNT(*) as total FROM assinaturas WHERE status = $1', ['ativa']),
        pool.query('SELECT COUNT(*) as total FROM licencas WHERE status = $1', ['ativa'])
      ]);

      const receitaResult = await pool.query(
        `SELECT COALESCE(SUM(p.preco), 0) as total
         FROM assinaturas a
         JOIN planos p ON a.plano_id = p.id
         WHERE a.status = 'ativa'
         AND EXTRACT(MONTH FROM a.data_inicio) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(YEAR FROM a.data_inicio) = EXTRACT(YEAR FROM CURRENT_DATE)`
      );

      res.json({
        success: true,
        totalClientes: parseInt(clientesResult.rows[0].total),
        assinaturasAtivas: parseInt(assinaturasResult.rows[0].total),
        licencasAtivas: parseInt(licencasResult.rows[0].total),
        receitaMensal: parseFloat(receitaResult.rows[0].total)
      });
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard statistics'
      });
    }
  }

  async getRecentEvents(req: Request, res: Response): Promise<void> {
    try {
      const result = await pool.query(
        `WITH all_events AS (
          -- Security events
          SELECT
            id::text as id,
            'security' as category,
            CASE
              WHEN event_type IN ('suspicious_process', 'multiple_instances', 'brute_force') THEN 'error'
              WHEN event_type IN ('time_manipulation', 'excessive_fingerprints') THEN 'warning'
              ELSE 'success'
            END as type,
            CASE
              WHEN event_type = 'time_manipulation' THEN 'Tentativa de manipulação de tempo detectada'
              WHEN event_type = 'suspicious_process' THEN 'Processo suspeito detectado'
              WHEN event_type = 'multiple_instances' THEN 'Múltiplas instâncias detectadas'
              WHEN event_type = 'impossible_velocity' THEN 'Velocidade de mudança impossível'
              WHEN event_type = 'excessive_fingerprints' THEN 'Excesso de fingerprints'
              WHEN event_type = 'brute_force' THEN 'Tentativa de força bruta'
              ELSE 'Evento de segurança'
            END as message,
            created_at
          FROM security_events
          WHERE created_at > NOW() - INTERVAL '24 hours'

          UNION ALL

          -- Audit logs (logins, CRUD operations)
          SELECT
            id::text as id,
            CASE
              WHEN action IN ('login_success', 'login_failed') THEN 'auth'
              WHEN action IN ('validation_success', 'validation_failed') THEN 'license'
              WHEN action IN ('create', 'update', 'delete') THEN 'admin'
              ELSE 'system'
            END as category,
            CASE
              WHEN action = 'login_failed' THEN 'error'
              WHEN action = 'validation_failed' THEN 'warning'
              WHEN action IN ('delete') THEN 'warning'
              ELSE 'success'
            END as type,
            CASE
              WHEN action = 'login_success' THEN CONCAT('Login bem-sucedido: ', COALESCE(new_values->>'email', 'usuário'))
              WHEN action = 'login_failed' THEN CONCAT('Falha de login: ', COALESCE(new_values->>'email', 'usuário'))
              WHEN action = 'validation_success' THEN CONCAT('Licença validada: ', entity_id)
              WHEN action = 'validation_failed' THEN CONCAT('Validação falhou: ', entity_id)
              WHEN action = 'create' THEN CONCAT('Criado ', entity_type, ': ', entity_id)
              WHEN action = 'update' THEN CONCAT('Atualizado ', entity_type, ': ', entity_id)
              WHEN action = 'delete' THEN CONCAT('Removido ', entity_type, ': ', entity_id)
              WHEN action = 'api_access' THEN CONCAT('Acesso API: ', new_values->>'endpoint')
              ELSE CONCAT(action, ' em ', entity_type)
            END as message,
            created_at
          FROM audit_logs
          WHERE created_at > NOW() - INTERVAL '24 hours'

          UNION ALL

          -- License validation history
          SELECT
            id::text as id,
            'validation' as category,
            CASE
              WHEN validation_result = false THEN 'error'
              WHEN risk_score > 0.7 THEN 'warning'
              ELSE 'success'
            END as type,
            CONCAT(
              'Validação de licença: ',
              license_key,
              ' - ',
              CASE WHEN validation_result THEN 'Sucesso' ELSE 'Falhou' END
            ) as message,
            created_at
          FROM validation_history
          WHERE created_at > NOW() - INTERVAL '24 hours'
        )
        SELECT
          id,
          category,
          type,
          message,
          CASE
            WHEN created_at > NOW() - INTERVAL '5 minutes' THEN '5 min'
            WHEN created_at > NOW() - INTERVAL '15 minutes' THEN '15 min'
            WHEN created_at > NOW() - INTERVAL '30 minutes' THEN '30 min'
            WHEN created_at > NOW() - INTERVAL '1 hour' THEN '1h'
            WHEN created_at > NOW() - INTERVAL '2 hours' THEN '2h'
            WHEN created_at > NOW() - INTERVAL '12 hours' THEN TO_CHAR(created_at, 'HH24:MI')
            ELSE TO_CHAR(created_at, 'DD/MM HH24:MI')
          END as time
        FROM all_events
        ORDER BY created_at DESC
        LIMIT 10`
      );

      res.json(result.rows);
    } catch (error: any) {
      console.error('Error fetching recent events:', error);
      res.json([]);
    }
  }

  async getLicenseData(req: Request, res: Response): Promise<void> {
    try {
      const result = await pool.query(
        `WITH months AS (
          SELECT generate_series(
            DATE_TRUNC('month', NOW() - INTERVAL '5 months'),
            DATE_TRUNC('month', NOW()),
            '1 month'::interval
          ) AS month
        )
        SELECT
          TO_CHAR(m.month, 'Mon') as month,
          COALESCE(COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'ativa'), 0) as ativas,
          COALESCE(COUNT(DISTINCT l.id) FILTER (WHERE DATE_TRUNC('month', l.created_at) = m.month), 0) as novas,
          COALESCE(COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'expirada'), 0) as expiradas
        FROM months m
        LEFT JOIN licencas l ON DATE_TRUNC('month', l.created_at) <= m.month
        GROUP BY m.month
        ORDER BY m.month`
      );

      res.json(result.rows);
    } catch (error: any) {
      console.error('Error fetching license data:', error);
      res.json([]);
    }
  }

  async getSecurityData(req: Request, res: Response): Promise<void> {
    try {
      const result = await pool.query(
        `SELECT
          severity as name,
          COUNT(*) as value,
          CASE
            WHEN severity = 'low' THEN '#4caf50'
            WHEN severity = 'medium' THEN '#ff9800'
            WHEN severity = 'high' THEN '#f44336'
            WHEN severity = 'critical' THEN '#9c27b0'
            ELSE '#757575'
          END as color
        FROM security_events
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY severity`
      );

      res.json(result.rows.length > 0 ? result.rows : [
        { name: 'Baixo', value: 0, color: '#4caf50' },
        { name: 'Médio', value: 0, color: '#ff9800' },
        { name: 'Alto', value: 0, color: '#f44336' },
        { name: 'Crítico', value: 0, color: '#9c27b0' }
      ]);
    } catch (error: any) {
      console.error('Error fetching security data:', error);
      res.json([]);
    }
  }
}

export const dashboardController = new DashboardController();