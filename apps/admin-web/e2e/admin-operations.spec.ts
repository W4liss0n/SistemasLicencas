import { expect, test } from '@playwright/test';

type AdminLicenseResponse = {
  success: true;
  license: {
    id: string;
    license_key: string;
    status: string;
    max_offline_hours: number;
    transfer_count: number;
    created_at: string;
    updated_at: string;
  };
  subscription: {
    id: string;
    status: string;
    start_at: string;
    end_at: string;
    auto_renew: boolean;
  };
  plan: {
    id: string;
    code: string;
    name: string;
    max_devices: number;
    max_offline_hours: number;
    features: string[];
  };
  customer: {
    id: string;
    email: string;
    name: string;
    document: string | null;
  };
  devices: Array<{
    id: string;
    is_active: boolean;
    fingerprint_hash: string;
    match_source: string;
    last_seen_at: string | null;
    created_at: string;
  }>;
};

function buildLicenseResponse(params?: {
  licenseKey?: string;
  status?: string;
  subscriptionEndAt?: string;
}): AdminLicenseResponse {
  const licenseKey = params?.licenseKey ?? 'LIC-E2E-0001';
  const status = params?.status ?? 'active';
  const subscriptionEndAt = params?.subscriptionEndAt ?? '2027-03-31T23:59:59.000Z';

  return {
    success: true,
    license: {
      id: 'lic-id-1',
      license_key: licenseKey,
      status,
      max_offline_hours: 72,
      transfer_count: 0,
      created_at: '2026-03-05T10:00:00.000Z',
      updated_at: '2026-03-05T10:00:00.000Z'
    },
    subscription: {
      id: 'sub-id-1',
      status: status === 'inactive' ? 'cancelled' : 'active',
      start_at: '2026-03-01T00:00:00.000Z',
      end_at: subscriptionEndAt,
      auto_renew: false
    },
    plan: {
      id: 'plan-id-1',
      code: 'basic',
      name: 'Basic',
      max_devices: 3,
      max_offline_hours: 72,
      features: ['core']
    },
    customer: {
      id: 'customer-id-1',
      email: 'ops@example.com',
      name: 'Ops User',
      document: null
    },
    devices: []
  };
}

test('critical admin flows execute mutations with idempotency key', async ({ page }) => {
  let currentLicense = buildLicenseResponse();
  const mutationPaths: string[] = [];
  const idempotencyKeys: string[] = [];

  await page.route('**/config.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.__ADMIN_WEB_CONFIG__ = { adminWebEnableMutations: true };'
    });
  });

  await page.route('**/admin-api/operational-summary**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generated_at: '2026-03-05T10:00:00.000Z',
        window_days: 7,
        totals: {
          customers: 1,
          subscriptions_active: 1,
          licenses: 1,
          licenses_active: 1,
          devices_active: 0
        },
        recent: {
          validation_failures: 0,
          security_events_critical: 0,
          transfer_events: 0,
          deactivate_events: 0
        }
      })
    });
  });

  await page.route('**/admin-api/programs**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        items: [
          {
            id: 'program-id-1',
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
        page_size: 100,
        total: 1
      })
    });
  });

  await page.route('**/admin-api/plans**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        items: [
          {
            ...currentLicense.plan,
            description: null,
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T10:00:00.000Z',
            programs: [
              {
                id: 'program-id-1',
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
        page_size: 100,
        total: 1
      })
    });
  });

  await page.route('**/admin-api/licenses', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    const idempotencyKey = route.request().headers()['idempotency-key'];
    expect(idempotencyKey).toBeTruthy();

    const payload = route.request().postDataJSON() as {
      customer: { email: string; name: string };
    };

    mutationPaths.push('provision');
    idempotencyKeys.push(idempotencyKey ?? '');

    currentLicense = buildLicenseResponse({
      licenseKey: 'LIC-E2E-NEW-001',
      status: 'active'
    });
    currentLicense.customer.email = payload.customer.email;
    currentLicense.customer.name = payload.customer.name;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentLicense)
    });
  });

  await page.route('**/admin-api/licenses/*/renew', async (route) => {
    const idempotencyKey = route.request().headers()['idempotency-key'];
    expect(idempotencyKey).toBeTruthy();

    const payload = route.request().postDataJSON() as { new_end_at: string };
    mutationPaths.push('renew');
    idempotencyKeys.push(idempotencyKey ?? '');

    currentLicense.subscription.end_at = payload.new_end_at;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentLicense)
    });
  });

  await page.route('**/admin-api/licenses/*/block', async (route) => {
    const idempotencyKey = route.request().headers()['idempotency-key'];
    expect(idempotencyKey).toBeTruthy();

    mutationPaths.push('block');
    idempotencyKeys.push(idempotencyKey ?? '');
    currentLicense.license.status = 'blocked';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentLicense)
    });
  });

  await page.route('**/admin-api/licenses/*/unblock', async (route) => {
    const idempotencyKey = route.request().headers()['idempotency-key'];
    expect(idempotencyKey).toBeTruthy();

    mutationPaths.push('unblock');
    idempotencyKeys.push(idempotencyKey ?? '');
    currentLicense.license.status = 'active';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentLicense)
    });
  });

  await page.route('**/admin-api/licenses/*/cancel', async (route) => {
    const idempotencyKey = route.request().headers()['idempotency-key'];
    expect(idempotencyKey).toBeTruthy();

    mutationPaths.push('cancel');
    idempotencyKeys.push(idempotencyKey ?? '');
    currentLicense.license.status = 'inactive';
    currentLicense.subscription.status = 'cancelled';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentLicense)
    });
  });

  await page.route('**/admin-api/licenses/*', async (route) => {
    if (route.request().method() === 'PATCH') {
      const idempotencyKey = route.request().headers()['idempotency-key'];
      expect(idempotencyKey).toBeTruthy();

      const payload = route.request().postDataJSON() as {
        subscription_end_at: string;
        auto_renew: boolean;
        max_offline_hours: number;
      };

      mutationPaths.push('update');
      idempotencyKeys.push(idempotencyKey ?? '');
      currentLicense.subscription.end_at = payload.subscription_end_at;
      currentLicense.subscription.auto_renew = payload.auto_renew;
      currentLicense.license.max_offline_hours = payload.max_offline_hours;
      currentLicense.license.updated_at = '2026-03-05T11:00:00.000Z';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentLicense)
      });
      return;
    }

    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentLicense)
    });
  });

  await page.route('**/admin-api/customers**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        items: [
          {
            id: currentLicense.customer.id,
            email: currentLicense.customer.email,
            name: currentLicense.customer.name,
            document: currentLicense.customer.document,
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T10:00:00.000Z',
            licenses_count: 1,
            last_subscription_status: currentLicense.subscription.status
          }
        ],
        page: 1,
        page_size: 20,
        total: 1
      })
    });
  });

  await page.route('**/admin-api/customers/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        customer: {
          id: currentLicense.customer.id,
          email: currentLicense.customer.email,
          name: currentLicense.customer.name,
          document: currentLicense.customer.document,
          created_at: '2026-03-05T10:00:00.000Z',
          updated_at: '2026-03-05T10:00:00.000Z'
        },
        licenses: [
          {
            license: currentLicense.license,
            subscription: currentLicense.subscription,
            plan: currentLicense.plan,
            programs: [],
            devices: currentLicense.devices
          }
        ]
      })
    });
  });

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Operador' }).fill('ops-user');
  await page.getByRole('button', { name: 'Entrar no control room' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Provisionar', exact: true }).click();
  await page.getByRole('button', { name: 'Nova provisao' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('operator@example.com');
  await page.getByRole('textbox', { name: 'Nome' }).fill('Operator E2E');
  await page.getByRole('textbox', { name: /Fim da assinatura|Subscription end at/i }).fill('2027-04-01T23:59:59.000Z');
  await page.getByRole('button', { name: 'Provisionar licenca' }).click();
  await expect(page.getByText(/Licenca criada com sucesso/i)).toBeVisible();

  await page.getByRole('link', { name: 'Clientes' }).click();
  await page.getByText('Operator E2E').click();
  await page.getByRole('tab', { name: 'Licencas' }).click();
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Fim da assinatura').fill('2027-06-01T12:30');
  await page.getByLabel('Maximo de horas offline').fill('96');
  await page.getByRole('switch', { name: 'Renovacao automatica' }).click();
  await page.getByRole('button', { name: 'Salvar licenca' }).click();
  await expect(page.getByText(/96 horas offline/i)).toBeVisible();

  await page.getByRole('link', { name: /^Buscar Licenca/ }).first().click();
  await page.getByRole('textbox', { name: /Chave da licenca|License Key/i }).fill(currentLicense.license.license_key);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page).toHaveURL(/\/licenses\/LIC-E2E-NEW-001$/);

  await page.getByRole('button', { name: /^Renovar$/ }).click();
  await page.getByRole('textbox', { name: 'Nova data fim' }).fill('2028-01-01T00:00:00.000Z');
  await page.getByRole('textbox', { name: 'Motivo' }).fill('manual-renew');
  await page.getByRole('button', { name: 'Confirmar' }).click();

  await page.getByRole('button', { name: /^Bloquear$/ }).click();
  await page.getByRole('textbox', { name: 'Motivo' }).fill('manual-block');
  await page.getByRole('button', { name: 'Confirmar' }).click();

  await page.getByRole('button', { name: /^Desbloquear$/ }).click();
  await page.getByRole('textbox', { name: 'Motivo' }).fill('manual-unblock');
  await page.getByRole('button', { name: 'Confirmar' }).click();

  await page.getByRole('button', { name: /^Cancelar$/ }).click();
  await page.getByRole('textbox', { name: 'Motivo' }).fill('manual-cancel');
  await page.getByRole('button', { name: 'Confirmar' }).click();

  expect(mutationPaths).toEqual(['provision', 'update', 'renew', 'block', 'unblock', 'cancel']);
  expect(idempotencyKeys).toHaveLength(6);
  expect(idempotencyKeys.every((key) => key.trim().length > 0)).toBe(true);
});
