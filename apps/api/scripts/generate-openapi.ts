import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function ensureEnvDefaults(): void {
  const defaults: Record<string, string> = {
    NODE_ENV: 'test',
    PORT: '3001',
    API_PREFIX: '/api/v2',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/sistema_licencas_v2',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'dev_jwt_secret_with_32_chars_minimum',
    ACCESS_JWT_SECRET: 'dev_access_jwt_secret_with_32_chars_minimum',
    REFRESH_JWT_SECRET: 'dev_refresh_jwt_secret_with_32_chars_minimum',
    OFFLINE_JWT_KID: 'openapi-offline-key-v1',
    OFFLINE_MAX_HOURS: '72',
    CLOCK_SKEW_SECONDS: '120',
    REFRESH_TTL_DAYS: '7',
    ACCESS_TTL_MINUTES: '15',
    END_USER_AUTH_ENABLED: 'false',
    AUTH_PASSWORD_PEPPER: 'dev_auth_pepper_with_32_chars_minimum',
    REQUEST_TIMEOUT_MS: '3000',
    IDEMPOTENCY_TTL_HOURS: '24',
    INTERNAL_ADMIN_API_KEYS: 'dev-internal-admin-key',
    OTEL_ENABLED: 'false',
    OTEL_SERVICE_NAME: 'sistema-licencas-v2-openapi',
    METRICS_ENABLED: 'false',
    METRICS_PATH: '/metrics'
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function run(): Promise<void> {
  ensureEnvDefaults();
  const { createApp } = await import('../src/bootstrap');
  const app = await createApp();

  const config = new DocumentBuilder()
    .setTitle('Sistema Licencas API v2')
    .setDescription('Contract-first API for licensing runtime rewrite')
    .setVersion('2.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.openapi = '3.1.0';

  const outputDir = join(process.cwd(), '..', '..', '.openapi');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'openapi.v2.json'), JSON.stringify(document, null, 2));

  await app.close();
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to generate OpenAPI document', error);
  process.exit(1);
});
