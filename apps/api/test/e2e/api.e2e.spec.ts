import request = require('supertest');
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap';

const PROGRAM_ID = 'demo-program';

const fingerprintA = {
  raw_components: {
    machine_id: 'MACHINE-A',
    disk_serial: 'DISK-A'
  }
};

const fingerprintB = {
  raw_components: {
    machine_id: 'MACHINE-B',
    disk_serial: 'DISK-B'
  }
};

describe('API v2 e2e', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v2/health returns service status and trace_id', async () => {
    const response = await request(app.getHttpServer()).get('/api/v2/health').expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('dependencies');
    expect(response.body).toHaveProperty('trace_id');
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('POST /api/v2/license/authenticate requires X-Program-Id', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/license/authenticate')
      .send({ identifier: 'demo@example.com', password: 'demo123' })
      .expect(401);

    expect(response.body.code).toBe('unauthorized_program');
  });

  it('POST /api/v2/license/authenticate returns token for demo credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/license/authenticate')
      .set('X-Program-Id', PROGRAM_ID)
      .send({ identifier: 'demo@example.com', password: 'demo123' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.access_token).toBeDefined();
    expect(response.body.trace_id).toBeDefined();
  });

  it('POST /api/v2/license/authenticate returns 401 problem+json for invalid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/license/authenticate')
      .set('X-Program-Id', PROGRAM_ID)
      .send({ identifier: 'demo@example.com', password: 'wrong-pass' })
      .expect(401);

    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body.code).toBe('invalid_credentials');
    expect(response.body.trace_id).toBeDefined();
  });

  it('POST /api/v2/licenses/validate requires X-Program-Id', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/validate')
      .send({
        license_key: 'LIC-DEMO-ACTIVE-0001',
        device_fingerprint: fingerprintA
      })
      .expect(401);

    expect(response.body.code).toBe('unauthorized_program');
  });

  it('POST /api/v2/licenses/validate returns 400 for invalid payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/validate')
      .set('X-Program-Id', PROGRAM_ID)
      .send({ license_key: 'LIC-AAAA' })
      .expect(400);

    expect(response.body.code).toBe('invalid_request');
    expect(response.body.trace_id).toBeDefined();
  });

  it('POST /api/v2/licenses/validate returns 404 when license does not exist', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/validate')
      .set('X-Program-Id', PROGRAM_ID)
      .send({
        license_key: 'BAD-KEY-000',
        device_fingerprint: fingerprintA
      })
      .expect(404);

    expect(response.body.code).toBe('license_not_found');
  });

  it('POST /api/v2/licenses/validate returns 403 when license is blocked', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/validate')
      .set('X-Program-Id', PROGRAM_ID)
      .send({
        license_key: 'LIC-BLK-0000',
        device_fingerprint: fingerprintA
      })
      .expect(403);

    expect(response.body.code).toBe('license_blocked');
  });

  it('POST /api/v2/licenses/validate returns 500 for synthetic internal failure', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/validate')
      .set('X-Program-Id', PROGRAM_ID)
      .send({
        license_key: 'LIC-ERR-500-CASE',
        device_fingerprint: fingerprintA
      })
      .expect(500);

    expect(response.body.code).toBe('internal_error');
    expect(response.body.trace_id).toBeDefined();
  });

  it('POST /api/v2/licenses/activate requires Idempotency-Key', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/activate')
      .set('X-Program-Id', PROGRAM_ID)
      .send({
        license_key: 'LIC-ACT-0001',
        device_fingerprint: fingerprintA
      })
      .expect(400);

    expect(response.body.code).toBe('invalid_request');
  });

  it('POST /api/v2/licenses/activate succeeds with canonical payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/activate')
      .set('X-Program-Id', PROGRAM_ID)
      .set('Idempotency-Key', 'idem-activate-1')
      .send({
        license_key: 'LIC-ACT-0001',
        device_fingerprint: fingerprintA
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.valid).toBe(true);
    expect(response.body.license_info.license_key).toBe('LIC-ACT-0001');
  });

  it('POST /api/v2/licenses/activate returns max_devices_reached when adding second device', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/licenses/activate')
      .set('X-Program-Id', PROGRAM_ID)
      .set('Idempotency-Key', 'idem-activate-max-1')
      .send({
        license_key: 'LIC-ACT-MAX-0001',
        device_fingerprint: fingerprintA
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/activate')
      .set('X-Program-Id', PROGRAM_ID)
      .set('Idempotency-Key', 'idem-activate-max-2')
      .send({
        license_key: 'LIC-ACT-MAX-0001',
        device_fingerprint: fingerprintB
      })
      .expect(409);

    expect(response.body.code).toBe('max_devices_reached');
  });

  it('POST /api/v2/licenses/heartbeat succeeds for active device', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/licenses/activate')
      .set('X-Program-Id', PROGRAM_ID)
      .set('Idempotency-Key', 'idem-heartbeat-activate')
      .send({
        license_key: 'LIC-HBT-0001',
        device_fingerprint: fingerprintA
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/heartbeat')
      .set('X-Program-Id', PROGRAM_ID)
      .send({
        license_key: 'LIC-HBT-0001',
        device_fingerprint: fingerprintA
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.next_heartbeat).toBe(3600);
  });

  it('POST /api/v2/licenses/heartbeat returns canonical error for unknown device', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/heartbeat')
      .set('X-Program-Id', PROGRAM_ID)
      .send({
        license_key: 'LIC-HBT-0001',
        device_fingerprint: fingerprintB
      })
      .expect(403);

    expect(response.body.code).toBe('fingerprint_mismatch');
  });

  it('POST /api/v2/licenses/transfer supports idempotent replay', async () => {
    const payload = {
      license_key: 'LIC-TRN-0001',
      new_device_fingerprint: fingerprintB,
      reason: 'device_replacement'
    };

    const first = await request(app.getHttpServer())
      .post('/api/v2/licenses/transfer')
      .set('X-Program-Id', PROGRAM_ID)
      .set('Idempotency-Key', 'idem-transfer-replay')
      .send(payload)
      .expect(200);

    const replay = await request(app.getHttpServer())
      .post('/api/v2/licenses/transfer')
      .set('X-Program-Id', PROGRAM_ID)
      .set('Idempotency-Key', 'idem-transfer-replay')
      .send(payload)
      .expect(200);

    expect(first.body.success).toBe(true);
    expect(replay.body.success).toBe(true);
    expect(replay.body.transfer_count_month).toBe(first.body.transfer_count_month);
  });

  it('POST /api/v2/licenses/transfer returns 409 for idempotency conflict', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/licenses/transfer')
      .set('X-Program-Id', PROGRAM_ID)
      .set('Idempotency-Key', 'idem-transfer-conflict')
      .send({
        license_key: 'LIC-TRN-0002',
        new_device_fingerprint: fingerprintA
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/transfer')
      .set('X-Program-Id', PROGRAM_ID)
      .set('Idempotency-Key', 'idem-transfer-conflict')
      .send({
        license_key: 'LIC-TRN-0002',
        new_device_fingerprint: fingerprintB
      })
      .expect(409);

    expect(response.body.code).toBe('idempotency_key_conflict');
  });

  it('POST /api/v2/licenses/transfer returns 429 when transfer limit is exceeded', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/transfer')
      .set('X-Program-Id', PROGRAM_ID)
      .set('Idempotency-Key', 'idem-transfer-limit')
      .send({
        license_key: 'LIC-LIM-TRN-0004',
        new_device_fingerprint: fingerprintA
      })
      .expect(429);

    expect(response.body.code).toBe('transfer_limit_exceeded');
  });

  it('POST /api/v2/licenses/deactivate deactivates current device', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/licenses/activate')
      .set('X-Program-Id', PROGRAM_ID)
      .set('Idempotency-Key', 'idem-deactivate-activate')
      .send({
        license_key: 'LIC-DEC-0001',
        device_fingerprint: fingerprintA
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/deactivate')
      .set('X-Program-Id', PROGRAM_ID)
      .set('Idempotency-Key', 'idem-deactivate-1')
      .send({
        license_key: 'LIC-DEC-0001',
        device_fingerprint: fingerprintA
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain('deactivated');
  });

  it('POST /api/v2/licenses/deactivate returns canonical error for non-registered device', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/licenses/deactivate')
      .set('X-Program-Id', PROGRAM_ID)
      .set('Idempotency-Key', 'idem-deactivate-2')
      .send({
        license_key: 'LIC-DEC-0001',
        device_fingerprint: fingerprintB
      })
      .expect(403);

    expect(response.body.code).toBe('fingerprint_mismatch');
  });

  it('rate limit returns 429 under sustained burst', async () => {
    let got429 = false;

    for (let i = 0; i < 110; i += 1) {
      const response = await request(app.getHttpServer()).get('/api/v2/health');
      if (response.status === 429) {
        got429 = true;
        break;
      }
    }

    expect(got429).toBe(true);
  });
});
