import request = require('supertest');
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const INTERNAL_KEY = 'dev-internal-admin-key';

describe('Admin internal API e2e', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const { createApp } = await import('../../src/bootstrap');
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires X-Internal-Api-Key header', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/internal/admin/operational-summary')
      .expect(401);

    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body.code).toBe('unauthorized_internal');
  });

  it('requires Idempotency-Key for internal mutations', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/internal/admin/licenses')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .send({
        program_code: 'demo-program',
        plan_code: 'basic',
        customer: {
          email: 'adminflow@example.com',
          name: 'Admin Flow'
        },
        subscription_end_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .expect(400);

    expect(response.body.code).toBe('invalid_request');
  });

  it('requires Idempotency-Key for internal patch mutations', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v2/internal/admin/licenses/LIC-DEMO-MISSING')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .send({
        subscription_end_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        auto_renew: true,
        max_offline_hours: 96
      })
      .expect(400);

    expect(response.body.code).toBe('invalid_request');
  });

  it('requires Idempotency-Key for catalog mutations', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/internal/admin/programs')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .send({
        name: 'No Idempotency Program'
      })
      .expect(400);

    expect(response.body.code).toBe('invalid_request');
  });

  it('requires Idempotency-Key for catalog patch mutations', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v2/internal/admin/plans/22222222-2222-4222-8222-222222222222')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .send({
        name: 'Basic Updated',
        max_devices: 2,
        max_offline_hours: 96,
        features: ['validate', 'heartbeat'],
        program_ids: ['11111111-1111-4111-8111-111111111111']
      })
      .expect(400);

    expect(response.body.code).toBe('invalid_request');
  });

  it('supports provision -> block -> unblock -> renew -> cancel flow', async () => {
    const provisionPayload = {
      program_code: 'demo-program',
      plan_code: 'basic',
      customer: {
        email: 'adminflow@example.com',
        name: 'Admin Flow'
      },
      subscription_end_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      requested_by: 'qa-test'
    };

    const provision = await request(app.getHttpServer())
      .post('/api/v2/internal/admin/licenses')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-provision-1')
      .send(provisionPayload)
      .expect(200);

    expect(provision.body.success).toBe(true);
    const licenseKey = provision.body.license.license_key;

    const replay = await request(app.getHttpServer())
      .post('/api/v2/internal/admin/licenses')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-provision-1')
      .send(provisionPayload)
      .expect(200);
    expect(replay.body.license.license_key).toBe(licenseKey);

    const block = await request(app.getHttpServer())
      .post(`/api/v2/internal/admin/licenses/${licenseKey}/block`)
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-block-1')
      .send({ reason: 'qa-check' })
      .expect(200);
    expect(block.body.license.status).toBe('blocked');

    const unblock = await request(app.getHttpServer())
      .post(`/api/v2/internal/admin/licenses/${licenseKey}/unblock`)
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-unblock-1')
      .send({ reason: 'qa-check' })
      .expect(200);
    expect(unblock.body.license.status).toBe('active');

    const renew = await request(app.getHttpServer())
      .post(`/api/v2/internal/admin/licenses/${licenseKey}/renew`)
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-renew-1')
      .send({
        new_end_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .expect(200);
    expect(renew.body.subscription.status).toBe('active');

    const cancel = await request(app.getHttpServer())
      .post(`/api/v2/internal/admin/licenses/${licenseKey}/cancel`)
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-cancel-1')
      .send({ reason: 'qa-check' })
      .expect(200);
    expect(cancel.body.license.status).toBe('inactive');
    expect(cancel.body.subscription.status).toBe('cancelled');

    const details = await request(app.getHttpServer())
      .get(`/api/v2/internal/admin/licenses/${licenseKey}`)
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .expect(200);
    expect(details.body.license.status).toBe('inactive');
  });

  it('returns validation error for invalid window_days query', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/internal/admin/operational-summary?window_days=abc')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .expect(400);

    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body.code).toBe('invalid_request');
  });

  it('supports program -> plan -> onboard customer flow with idempotency replay', async () => {
    const createProgramPayload = {
      name: 'Desktop Client Runtime',
      description: 'Program for desktop runtime'
    };
    const createProgram = await request(app.getHttpServer())
      .post('/api/v2/internal/admin/programs')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-program-1')
      .send(createProgramPayload)
      .expect(200);

    expect(createProgram.body.success).toBe(true);
    const programId = createProgram.body.program.id as string;

    const replayProgram = await request(app.getHttpServer())
      .post('/api/v2/internal/admin/programs')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-program-1')
      .send(createProgramPayload)
      .expect(200);
    expect(replayProgram.body.program.id).toBe(programId);

    const createPlanPayload = {
      name: 'Desktop Pro Plan',
      max_devices: 3,
      max_offline_hours: 120,
      features: ['validate', 'activate'],
      program_ids: [programId]
    };
    const createPlan = await request(app.getHttpServer())
      .post('/api/v2/internal/admin/plans')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-plan-1')
      .send(createPlanPayload)
      .expect(200);

    expect(createPlan.body.success).toBe(true);
    expect(createPlan.body.plan.programs).toHaveLength(1);
    const planId = createPlan.body.plan.id as string;

    const updatePlanPayload = {
      name: 'Desktop Pro Plan Updated',
      description: 'Updated from e2e',
      max_devices: 4,
      max_offline_hours: 144,
      features: ['validate', 'activate', 'analytics'],
      program_ids: [programId]
    };
    const updatePlan = await request(app.getHttpServer())
      .patch(`/api/v2/internal/admin/plans/${planId}`)
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-plan-update-1')
      .send(updatePlanPayload)
      .expect(200);

    expect(updatePlan.body.plan.name).toBe('Desktop Pro Plan Updated');
    expect(updatePlan.body.plan.max_offline_hours).toBe(144);

    const replayPlanUpdate = await request(app.getHttpServer())
      .patch(`/api/v2/internal/admin/plans/${planId}`)
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-plan-update-1')
      .send(updatePlanPayload)
      .expect(200);
    expect(replayPlanUpdate.body.plan.name).toBe('Desktop Pro Plan Updated');

    const onboardPayload = {
      selection_mode: 'plan',
      customer: {
        email: 'new-onboard@example.com',
        name: 'New Onboard User'
      },
      program_id: programId,
      plan_id: planId,
      subscription_end_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
    };
    const onboard = await request(app.getHttpServer())
      .post('/api/v2/internal/admin/customers/onboard')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-onboard-1')
      .send(onboardPayload)
      .expect(200);

    expect(onboard.body.success).toBe(true);
    expect(onboard.body.customer.email).toBe('new-onboard@example.com');
    expect(onboard.body.end_user.identifier).toBe('new-onboard@example.com');
    const onboardedLicenseKey = onboard.body.license.license_key as string;

    const replayOnboard = await request(app.getHttpServer())
      .post('/api/v2/internal/admin/customers/onboard')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-onboard-1')
      .send(onboardPayload)
      .expect(200);
    expect(replayOnboard.body.license.license_key).toBe(onboardedLicenseKey);

    const details = await request(app.getHttpServer())
      .get(`/api/v2/internal/admin/licenses/${onboardedLicenseKey}`)
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .expect(200);
    expect(details.body.customer.email).toBe('new-onboard@example.com');

    const updateLicensePayload = {
      subscription_end_at: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
      auto_renew: true,
      max_offline_hours: 96
    };
    const updatedLicense = await request(app.getHttpServer())
      .patch(`/api/v2/internal/admin/licenses/${onboardedLicenseKey}`)
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-license-update-1')
      .send(updateLicensePayload)
      .expect(200);

    expect(updatedLicense.body.subscription.auto_renew).toBe(true);
    expect(updatedLicense.body.license.max_offline_hours).toBe(96);

    const replayLicenseUpdate = await request(app.getHttpServer())
      .patch(`/api/v2/internal/admin/licenses/${onboardedLicenseKey}`)
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .set('Idempotency-Key', 'internal-license-update-1')
      .send(updateLicensePayload)
      .expect(200);
    expect(replayLicenseUpdate.body.license.max_offline_hours).toBe(96);

    const customers = await request(app.getHttpServer())
      .get('/api/v2/internal/admin/customers?page=1&page_size=20&q=new-onboard')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .expect(200);
    expect(customers.body.items).toHaveLength(1);
    expect(customers.body.items[0].licenses_count).toBeGreaterThanOrEqual(1);
  });
});


