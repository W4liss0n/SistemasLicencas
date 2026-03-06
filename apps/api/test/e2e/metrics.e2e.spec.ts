import request = require('supertest');
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

function snapshotEnvironment(): NodeJS.ProcessEnv {
  return { ...process.env };
}

function restoreEnvironment(snapshot: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}

async function bootApp(metricsEnabled: 'true' | 'false'): Promise<NestFastifyApplication> {
  process.env.METRICS_ENABLED = metricsEnabled;
  process.env.METRICS_PATH = '/metrics';

  jest.resetModules();
  const { createApp } = await import('../../src/bootstrap');
  const app = await createApp();
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe('Metrics endpoint e2e', () => {
  jest.setTimeout(15_000);

  let envSnapshot: NodeJS.ProcessEnv;

  beforeEach(() => {
    envSnapshot = snapshotEnvironment();
  });

  afterEach(() => {
    restoreEnvironment(envSnapshot);
  });

  it('GET /api/v2/metrics returns 404 problem+json when disabled', async () => {
    const app = await bootApp('false');

    try {
      const response = await request(app.getHttpServer()).get('/api/v2/metrics').expect(404);

      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.body.detail).toContain('Metrics endpoint is disabled');
      expect(response.body.trace_id).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it('GET /api/v2/metrics returns Prometheus payload when enabled', async () => {
    const app = await bootApp('true');

    try {
      const response = await request(app.getHttpServer()).get('/api/v2/metrics').expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('http_requests_total');
      expect(response.text).toContain('idempotency_replay_total');
    } finally {
      await app.close();
    }
  });
});
