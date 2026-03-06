import { query } from '../../../data/database/config/postgres.config';
import { ISubscription } from '../../../shared/interfaces/license.interface';
import { SubscriptionStatus } from '../../../shared/types/license.types';

export class SubscriptionModel {
  static async create(subscription: Partial<ISubscription>): Promise<ISubscription> {
    const text = `
      INSERT INTO assinaturas (
        cliente_id, plano_id, data_inicio, data_fim,
        auto_renovar, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      subscription.cliente_id,
      subscription.plano_id,
      subscription.data_inicio,
      subscription.data_fim,
      subscription.auto_renovar || false,
      subscription.status || SubscriptionStatus.ACTIVE,
      JSON.stringify(subscription.metadata || {})
    ];

    const result = await query(text, values);
    return result.rows[0];
  }

  static async findById(id: string): Promise<ISubscription | null> {
    const text = `
      SELECT s.*, c.nome as cliente_nome, c.email as cliente_email,
             p.nome as plano_nome, p.preco as plano_preco, p.max_dispositivos, p.max_offline_dias
      FROM assinaturas s
      LEFT JOIN clientes c ON s.cliente_id = c.id
      LEFT JOIN planos p ON s.plano_id = p.id
      WHERE s.id = $1
    `;

    const result = await query(text, [id]);
    return result.rows[0] || null;
  }

  static async findByClientId(clientId: string): Promise<ISubscription[]> {
    const text = `
      SELECT s.*, p.nome as plano_nome, p.preco as plano_preco,
             COUNT(l.id) as total_licencas
      FROM assinaturas s
      LEFT JOIN planos p ON s.plano_id = p.id
      LEFT JOIN licencas l ON s.id = l.assinatura_id
      WHERE s.cliente_id = $1
      GROUP BY s.id, p.nome, p.preco
      ORDER BY s.created_at DESC
    `;

    const result = await query(text, [clientId]);
    return result.rows;
  }

  static async findActiveByClientId(clientId: string): Promise<ISubscription[]> {
    const text = `
      SELECT s.*, p.nome as plano_nome, p.preco as plano_preco,
             p.max_licencas, p.features
      FROM assinaturas s
      LEFT JOIN planos p ON s.plano_id = p.id
      WHERE s.cliente_id = $1
        AND s.status = 'ativa'
        AND s.data_fim >= CURRENT_DATE
      ORDER BY s.data_fim DESC
    `;

    const result = await query(text, [clientId]);
    return result.rows;
  }

  static async update(id: string, updates: Partial<ISubscription>): Promise<ISubscription> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(key === 'metadata' ? JSON.stringify(value) : value);
        paramCount++;
      }
    });

    values.push(id);
    const text = `
      UPDATE assinaturas
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(text, values);
    return result.rows[0];
  }

  static async findExpiringSubscriptions(days: number = 7): Promise<ISubscription[]> {
    const text = `
      SELECT s.*, c.nome as cliente_nome, c.email as cliente_email,
             p.nome as plano_nome
      FROM assinaturas s
      LEFT JOIN clientes c ON s.cliente_id = c.id
      LEFT JOIN planos p ON s.plano_id = p.id
      WHERE s.status = 'ativa'
        AND s.data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'
        AND s.auto_renovar = false
      ORDER BY s.data_fim
    `;

    const result = await query(text);
    return result.rows;
  }

  static async findExpiredSubscriptions(): Promise<ISubscription[]> {
    const text = `
      SELECT s.*
      FROM assinaturas s
      WHERE s.status = 'ativa'
        AND s.data_fim < CURRENT_DATE
    `;

    const result = await query(text);
    return result.rows;
  }

  static async expire(id: string): Promise<ISubscription> {
    return await this.update(id, {
      status: SubscriptionStatus.EXPIRED
    });
  }

  static async cancel(id: string): Promise<ISubscription> {
    return await this.update(id, {
      status: SubscriptionStatus.CANCELLED
    });
  }

  static async suspend(id: string): Promise<ISubscription> {
    return await this.update(id, {
      status: SubscriptionStatus.SUSPENDED
    });
  }

  static async renew(id: string, newEndDate: Date): Promise<ISubscription> {
    return await this.update(id, {
      data_fim: newEndDate,
      status: SubscriptionStatus.ACTIVE
    });
  }

  static async getStats(): Promise<any> {
    const text = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'ativa') as active_count,
        COUNT(*) FILTER (WHERE status = 'expirada') as expired_count,
        COUNT(*) FILTER (WHERE status = 'cancelada') as cancelled_count,
        COUNT(*) as total_count,
        AVG(EXTRACT(DAY FROM (data_fim - data_inicio))) as avg_duration_days
      FROM assinaturas
    `;

    const result = await query(text);
    return result.rows[0];
  }
}