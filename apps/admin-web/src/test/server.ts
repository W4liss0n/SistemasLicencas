import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const handlers = [
  http.get('/admin-api/operational-summary', () =>
    HttpResponse.json({
      generated_at: '2026-03-05T10:00:00.000Z',
      window_days: 7,
      totals: {
        customers: 10,
        subscriptions_active: 8,
        licenses: 12,
        licenses_active: 9,
        devices_active: 17
      },
      recent: {
        validation_failures: 2,
        security_events_critical: 0,
        transfer_events: 1,
        deactivate_events: 1
      }
    })
  ),
  http.get('/admin-api/programs', () =>
    HttpResponse.json({
      success: true,
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          code: 'demo-program',
          name: 'Demo Program',
          description: 'Seed program',
          status: 'active',
          metadata: {},
          created_at: '2026-03-05T10:00:00.000Z',
          updated_at: '2026-03-05T10:00:00.000Z'
        }
      ],
      page: 1,
      page_size: 20,
      total: 1
    })
  ),
  http.post('/admin-api/programs', async ({ request }) => {
    const payload = (await request.json()) as { name?: string };
    return HttpResponse.json({
      success: true,
      program: {
        id: '77777777-7777-4777-8777-777777777777',
        code: 'generated-program',
        name: payload.name ?? 'Program',
        description: null,
        status: 'active',
        metadata: {},
        created_at: '2026-03-05T10:00:00.000Z',
        updated_at: '2026-03-05T10:00:00.000Z'
      }
    });
  }),
  http.get('/admin-api/plans', () =>
    HttpResponse.json({
      success: true,
      items: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          code: 'basic',
          name: 'Basic',
          description: 'Plano basic',
          max_devices: 1,
          max_offline_hours: 72,
          features: ['validate'],
          created_at: '2026-03-05T10:00:00.000Z',
          updated_at: '2026-03-05T10:00:00.000Z',
          programs: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              code: 'demo-program',
              name: 'Demo Program',
              description: 'Seed program',
              status: 'active',
              metadata: {},
              created_at: '2026-03-05T10:00:00.000Z',
              updated_at: '2026-03-05T10:00:00.000Z'
            }
          ]
        }
      ],
      page: 1,
      page_size: 20,
      total: 1
    })
  ),
  http.post('/admin-api/plans', async ({ request }) => {
    const payload = (await request.json()) as { name?: string };
    return HttpResponse.json({
      success: true,
      plan: {
        id: '88888888-8888-4888-8888-888888888888',
        code: 'generated-plan',
        name: payload.name ?? 'Plan',
        description: null,
        max_devices: 1,
        max_offline_hours: 72,
        features: ['validate'],
        created_at: '2026-03-05T10:00:00.000Z',
        updated_at: '2026-03-05T10:00:00.000Z',
        programs: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            code: 'demo-program',
            name: 'Demo Program',
            description: 'Seed program',
            status: 'active',
            metadata: {},
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T10:00:00.000Z'
          }
        ]
      }
    });
  }),
  http.patch('/admin-api/plans/:planId', async ({ request, params }) => {
    const payload = (await request.json()) as {
      name?: string;
      description?: string | null;
      max_devices?: number;
      max_offline_hours?: number;
      features?: string[];
      program_ids?: string[];
    };

    return HttpResponse.json({
      success: true,
      plan: {
        id: params.planId,
        code: 'basic',
        name: payload.name ?? 'Updated Plan',
        description: payload.description ?? null,
        max_devices: payload.max_devices ?? 1,
        max_offline_hours: payload.max_offline_hours ?? 72,
        features: payload.features ?? ['validate'],
        created_at: '2026-03-05T10:00:00.000Z',
        updated_at: '2026-03-05T12:00:00.000Z',
        programs: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            code: 'demo-program',
            name: 'Demo Program',
            description: 'Seed program',
            status: 'active',
            metadata: {},
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T10:00:00.000Z'
          }
        ]
      }
    });
  }),
  http.get('/admin-api/customers', () =>
    HttpResponse.json({
      success: true,
      items: [
        {
          id: '99999999-9999-4999-8999-999999999999',
          email: 'customer@example.com',
          name: 'Customer',
          document: null,
          created_at: '2026-03-05T10:00:00.000Z',
          updated_at: '2026-03-05T10:00:00.000Z',
          licenses_count: 1,
          last_subscription_status: 'active'
        }
      ],
      page: 1,
      page_size: 20,
      total: 1
    })
  ),
  http.post('/admin-api/customers', async ({ request }) => {
    const payload = (await request.json()) as { customer?: { email?: string; name?: string; document?: string } };

    return HttpResponse.json({
      success: true,
      customer: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        email: payload.customer?.email ?? 'new@example.com',
        name: payload.customer?.name ?? 'New Customer',
        document: payload.customer?.document ?? null,
        created_at: '2026-03-05T10:00:00.000Z',
        updated_at: '2026-03-05T10:00:00.000Z'
      },
      end_user: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        identifier: payload.customer?.email ?? 'new@example.com',
        status: 'active',
        created_at: '2026-03-05T10:00:00.000Z',
        updated_at: '2026-03-05T10:00:00.000Z'
      }
    });
  }),
  http.get('/admin-api/customers/:customerId', ({ params }) =>
    HttpResponse.json({
      success: true,
      customer: {
        id: params.customerId,
        email: 'customer@example.com',
        name: 'Customer',
        document: null,
        created_at: '2026-03-05T10:00:00.000Z',
        updated_at: '2026-03-05T10:00:00.000Z'
      },
      licenses: [
        {
          license: {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            license_key: 'LIC-DEMO-ABC123',
            status: 'active',
            max_offline_hours: 72,
            transfer_count: 0,
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T10:00:00.000Z'
          },
          subscription: {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            status: 'active',
            start_at: '2026-03-05T10:00:00.000Z',
            end_at: '2027-03-05T10:00:00.000Z',
            auto_renew: false
          },
          plan: {
            id: '22222222-2222-4222-8222-222222222222',
            code: 'basic',
            name: 'Basic',
            max_devices: 1,
            max_offline_hours: 72,
            features: ['validate']
          },
          programs: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              code: 'demo-program',
              name: 'Demo Program',
              description: 'Seed program',
              status: 'active',
              metadata: {},
              created_at: '2026-03-05T10:00:00.000Z',
              updated_at: '2026-03-05T10:00:00.000Z'
            }
          ],
          devices: []
        }
      ]
    })
  ),
  http.patch('/admin-api/licenses/:licenseKey', async ({ request, params }) => {
    const payload = (await request.json()) as {
      subscription_end_at?: string;
      auto_renew?: boolean;
      max_offline_hours?: number;
    };

    return HttpResponse.json({
      success: true,
      license: {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        license_key: params.licenseKey,
        status: 'active',
        max_offline_hours: payload.max_offline_hours ?? 72,
        transfer_count: 0,
        created_at: '2026-03-05T10:00:00.000Z',
        updated_at: '2026-03-05T12:00:00.000Z'
      },
      subscription: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'active',
        start_at: '2026-03-05T10:00:00.000Z',
        end_at: payload.subscription_end_at ?? '2027-03-05T10:00:00.000Z',
        auto_renew: payload.auto_renew ?? false
      },
      plan: {
        id: '22222222-2222-4222-8222-222222222222',
        code: 'basic',
        name: 'Basic',
        max_devices: 1,
        max_offline_hours: 72,
        features: ['validate']
      },
      customer: {
        id: '99999999-9999-4999-8999-999999999999',
        email: 'customer@example.com',
        name: 'Customer',
        document: null
      },
      devices: []
    });
  }),
  http.post('/admin-api/customers/onboard', () =>
    HttpResponse.json({
      success: true,
      customer: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        email: 'new@example.com',
        name: 'New Customer',
        document: null,
        created_at: '2026-03-05T10:00:00.000Z',
        updated_at: '2026-03-05T10:00:00.000Z'
      },
      end_user: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        identifier: 'new@example.com',
        status: 'active',
        created_at: '2026-03-05T10:00:00.000Z',
        updated_at: '2026-03-05T10:00:00.000Z'
      },
      subscription: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'active',
        start_at: '2026-03-05T10:00:00.000Z',
        end_at: '2027-03-05T10:00:00.000Z',
        auto_renew: false
      },
      plan: {
        id: '22222222-2222-4222-8222-222222222222',
        code: 'basic',
        name: 'Basic',
        max_devices: 1,
        max_offline_hours: 72,
        features: ['validate']
      },
      program: {
        id: '11111111-1111-4111-8111-111111111111',
        code: 'demo-program',
        name: 'Demo Program',
        status: 'active'
      },
      license: {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        license_key: 'LIC-DEMO-ABC123',
        status: 'active',
        max_offline_hours: 72,
        transfer_count: 0,
        created_at: '2026-03-05T10:00:00.000Z',
        updated_at: '2026-03-05T10:00:00.000Z'
      }
    })
  )
];

export const server = setupServer(...handlers);
