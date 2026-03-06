import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'sistema_licencas',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const MIGRATIONS_DIR = path.join(__dirname, '../../src/data/database/migrations');

async function createMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(query);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query('SELECT filename FROM migrations ORDER BY filename');
  return result.rows.map(row => row.filename);
}

async function executeMigration(filename: string, content: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Execute migration
    await client.query(content);

    // Record migration
    await client.query(
      'INSERT INTO migrations (filename) VALUES ($1)',
      [filename]
    );

    await client.query('COMMIT');
    console.log(`✅ Migration executed: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations() {
  try {
    console.log('🚀 Starting database migration...\n');

    // Create migrations table if not exists
    await createMigrationsTable();

    // Get already executed migrations
    const executedMigrations = await getExecutedMigrations();

    // Get all migration files
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Execute pending migrations
    let pendingCount = 0;
    for (const file of migrationFiles) {
      if (!executedMigrations.includes(file)) {
        const filePath = path.join(MIGRATIONS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        await executeMigration(file, content);
        pendingCount++;
      }
    }

    if (pendingCount === 0) {
      console.log('✅ No pending migrations');
    } else {
      console.log(`\n✅ Successfully executed ${pendingCount} migration(s)`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations();