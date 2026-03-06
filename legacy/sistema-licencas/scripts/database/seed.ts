import { Pool } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'sistema_licencas',
  user: process.env.DB_USER || 'licencas_user',
  password: process.env.DB_PASSWORD || 'licencas123',
});

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🌱 Seeding database...\n');

    // Create test client
    const clientResult = await client.query(`
      INSERT INTO clientes (nome, email, telefone, empresa, status)
      VALUES ('João Silva', 'joao@example.com', '11999999999', 'Tech Solutions', 'ativo')
      RETURNING id
    `);
    const clientId = clientResult.rows[0].id;
    console.log('✅ Created test client');

    // Create test program
    const programResult = await client.query(`
      INSERT INTO programas (nome, descricao, versao, features, status)
      VALUES ('Software Pro', 'Professional software solution', '1.0.0', '["feature1", "feature2"]', 'ativo')
      RETURNING id
    `);
    const programId = programResult.rows[0].id;
    console.log('✅ Created test program');

    // Create test plan
    const planResult = await client.query(`
      INSERT INTO planos (nome, descricao, preco, duracao_dias, max_licencas, max_offline_dias, features, status)
      VALUES ('Professional', 'Professional Plan', 99.90, 30, 5, 7, '["all_features"]', 'ativo')
      RETURNING id
    `);
    const planId = planResult.rows[0].id;
    console.log('✅ Created test plan');

    // Link plan to program
    await client.query(`
      INSERT INTO plano_programas (plano_id, programa_id)
      VALUES ($1, $2)
    `, [planId, programId]);

    // Create active subscription
    const subscriptionResult = await client.query(`
      INSERT INTO assinaturas (cliente_id, plano_id, data_inicio, data_fim, auto_renovar, status)
      VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', false, 'ativa')
      RETURNING id
    `, [clientId, planId]);
    const subscriptionId = subscriptionResult.rows[0].id;
    console.log('✅ Created active subscription');

    // Create test license (programa_id removido - agora licença é vinculada ao plano)
    const licenseKey = 'LIC-TEST-1234-5678-ABCD';
    await client.query(`
      INSERT INTO licencas (assinatura_id, license_key, status, max_offline_hours)
      VALUES ($1, $2, 'ativa', 168)
    `, [subscriptionId, licenseKey]);
    console.log('✅ Created test license: ' + licenseKey);

    // Vincular programa ao plano (tabela plano_programas)
    await client.query(`
      INSERT INTO plano_programas (plano_id, programa_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [planId, programId]);
    console.log('✅ Linked program to plan');

    // Create admin user for web panel
    const adminPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await client.query(`
      INSERT INTO users (username, name, email, password_hash, role, is_active)
      VALUES ('admin', 'Admin Sistema', 'admin@sistema-licencas.com', $1, 'admin', true)
      ON CONFLICT (username) DO NOTHING
    `, [hashedPassword]);
    console.log('✅ Created admin user');

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('📋 Test Data Created Successfully!');
    console.log('========================================');
    console.log('\n🔑 Test Credentials:');
        console.log('   Program ID:', programId);
    console.log('   License Key:', licenseKey);
    console.log('\n👤 Admin Panel Credentials:');
    console.log('   Email: admin@sistema-licencas.com');
    console.log('   Password: admin123');
    console.log('\n💡 Save these credentials to test the system');
    console.log('========================================\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
