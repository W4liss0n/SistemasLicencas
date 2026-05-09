import request = require('supertest');
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const originalEnv = { ...process.env };

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

describe('production CORS e2e', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      PORT: '3999',
      API_PREFIX: '/api/v2',
      CORS_ALLOWED_ORIGINS: 'https://admin.example.com,https://app.example.com',
      DATABASE_URL:
        'postgresql://postgres:strong-prod-password@localhost:5432/sistema_licencas_v2',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'production-jwt-secret-at-least-32-characters',
      ACCESS_JWT_SECRET: 'production-access-secret-at-least-32-characters',
      REFRESH_JWT_SECRET: 'production-refresh-secret-at-least-32-characters',
      AUTH_PASSWORD_PEPPER: 'production-auth-pepper-at-least-32-characters',
      LICENSE_ENGINE_STRATEGY: 'auto',
      INTERNAL_ADMIN_API_KEYS: 'production-internal-key-with-32-characters',
      METRICS_ENABLED: 'false'
    });

    jest.resetModules();
    const { createApp } = await import('../../src/bootstrap');
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    restoreEnv();
  });

  it('allows an allowlisted browser origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/cors-probe')
      .set('Origin', 'https://admin.example.com')
      .expect(404);

    expect(response.headers['access-control-allow-origin']).toBe('https://admin.example.com');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow a non-allowlisted browser origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/cors-probe')
      .set('Origin', 'https://evil.example.com')
      .expect(404);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers.vary).toContain('Origin');
  });

  it('keeps non-browser requests working without Origin', async () => {
    const response = await request(app.getHttpServer()).get('/api/v2/cors-probe').expect(404);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.body).toHaveProperty('status', 404);
  });
});
