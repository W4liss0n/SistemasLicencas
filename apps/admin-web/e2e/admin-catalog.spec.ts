import { expect, test } from '@playwright/test';

type ProgramItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type PlanItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  max_devices: number;
  max_offline_hours: number;
  features: string[];
  created_at: string;
  updated_at: string;
  programs: ProgramItem[];
};

test('catalog flows send idempotency keys for programs, plans and onboarding', async ({ page }) => {
  const mutationPaths: string[] = [];
  const idempotencyKeys: string[] = [];

  const programs: ProgramItem[] = [
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
  ];
  const plans: PlanItem[] = [];
  let createdProgramId = '';
  let createdPlanId = '';

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
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          items: programs,
          page: 1,
          page_size: 20,
          total: programs.length
        })
      });
      return;
    }

    const idempotencyKey = route.request().headers()['idempotency-key'];
    expect(idempotencyKey).toBeTruthy();
    idempotencyKeys.push(idempotencyKey ?? '');
    mutationPaths.push('program');
    const payload = route.request().postDataJSON() as { name: string };
    const created: ProgramItem = {
      id: '55555555-5555-4555-8555-555555555555',
      code: 'desktop-fleet-aa11',
      name: payload.name,
      description: null,
      status: 'active',
      metadata: {},
      created_at: '2026-03-05T10:00:00.000Z',
      updated_at: '2026-03-05T10:00:00.000Z'
    };
    createdProgramId = created.id;
    programs.unshift(created);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        program: created
      })
    });
  });

  await page.route('**/admin-api/plans**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          items: plans,
          page: 1,
          page_size: 20,
          total: plans.length
        })
      });
      return;
    }

    const idempotencyKey = route.request().headers()['idempotency-key'];
    expect(idempotencyKey).toBeTruthy();
    idempotencyKeys.push(idempotencyKey ?? '');
    mutationPaths.push('plan');
    const payload = route.request().postDataJSON() as {
      name: string;
      max_devices: number;
      max_offline_hours: number;
      features: string[];
      program_ids: string[];
    };
    const linkedPrograms = programs.filter((program) => payload.program_ids.includes(program.id));
    const created: PlanItem = {
      id: '66666666-6666-4666-8666-666666666666',
      code: 'fleet-pro-bb22',
      name: payload.name,
      description: null,
      max_devices: payload.max_devices,
      max_offline_hours: payload.max_offline_hours,
      features: payload.features,
      created_at: '2026-03-05T10:00:00.000Z',
      updated_at: '2026-03-05T10:00:00.000Z',
      programs: linkedPrograms
    };
    createdPlanId = created.id;
    plans.unshift(created);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        plan: created
      })
    });
  });

  await page.route('**/admin-api/customers**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          items: [],
          page: 1,
          page_size: 20,
          total: 0
        })
      });
      return;
    }

    const idempotencyKey = route.request().headers()['idempotency-key'];
    expect(idempotencyKey).toBeTruthy();
    idempotencyKeys.push(idempotencyKey ?? '');
    mutationPaths.push('onboard');
    const payload = route.request().postDataJSON() as {
      customer: { email: string; name: string };
      program_id: string;
      plan_id: string;
      subscription_end_at: string;
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        customer: {
          id: '77777777-7777-4777-8777-777777777777',
          email: payload.customer.email,
          name: payload.customer.name,
          document: null,
          created_at: '2026-03-05T10:00:00.000Z',
          updated_at: '2026-03-05T10:00:00.000Z'
        },
        end_user: {
          id: '88888888-8888-4888-8888-888888888888',
          customer_id: '77777777-7777-4777-8777-777777777777',
          identifier: payload.customer.email,
          status: 'active',
          created_at: '2026-03-05T10:00:00.000Z',
          updated_at: '2026-03-05T10:00:00.000Z'
        },
        subscription: {
          id: '99999999-9999-4999-8999-999999999999',
          status: 'active',
          start_at: '2026-03-05T10:00:00.000Z',
          end_at: payload.subscription_end_at,
          auto_renew: false
        },
        plan: {
          id: payload.plan_id,
          code: 'fleet-pro-bb22',
          name: 'Fleet Pro',
          max_devices: 3,
          max_offline_hours: 120,
          features: ['validate', 'activate']
        },
        program: {
          id: payload.program_id,
          code: 'desktop-fleet-aa11',
          name: 'Desktop Fleet',
          status: 'active'
        },
        license: {
          id: '12121212-1212-4121-8121-121212121212',
          license_key: 'LIC-FLEET-123ABC',
          status: 'active',
          max_offline_hours: 120,
          transfer_count: 0,
          created_at: '2026-03-05T10:00:00.000Z',
          updated_at: '2026-03-05T10:00:00.000Z'
        }
      })
    });
  });

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Operador' }).fill('ops-user');
  await page.getByRole('button', { name: 'Entrar no control room' }).click();

  await page.getByRole('link', { name: 'Programas' }).click();
  await page.getByRole('button', { name: 'Novo programa' }).click();
  await page.getByLabel('Nome do programa').fill('Desktop Fleet');
  await page.getByRole('button', { name: 'Criar programa' }).click();
  await expect(page.getByText(/Programa criado com code/i)).toBeVisible();

  await page.getByRole('link', { name: 'Planos' }).click();
  await page.getByRole('button', { name: 'Novo plano' }).click();
  await page.getByLabel('Nome do plano').fill('Fleet Pro');
  await page.getByLabel(/Desktop Fleet/i).check();
  await page.getByRole('button', { name: 'Criar plano' }).click();
  await expect(page.getByText(/Plano criado com code/i)).toBeVisible();

  await page.getByRole('link', { name: 'Clientes' }).click();
  await page.getByRole('button', { name: 'Novo onboarding' }).click();
  await page.getByLabel('Email do cliente').fill('fleet@example.com');
  await page.getByLabel('Nome do cliente').fill('Fleet Operator');
  await page.getByRole('button', { name: /^Proximo$/ }).click();

  await page.getByRole('combobox', { name: 'Programa' }).click();
  await page.getByRole('option', { name: /^Desktop Fleet/ }).click();
  await page.getByRole('combobox', { name: 'Plano' }).click();
  await page.getByRole('option', { name: /^Fleet Pro/ }).click();
  await page.getByLabel(/Fim da assinatura|Subscription end at/i).fill('2027-03-31T23:59:59.000Z');
  await page.getByRole('button', { name: /^Proximo$/ }).click();
  await page.getByRole('button', { name: 'Confirmar onboarding' }).click();
  await expect(page.getByText(/LIC-FLEET-123ABC/i)).toBeVisible();

  expect(mutationPaths).toEqual(['program', 'plan', 'onboard']);
  expect(idempotencyKeys).toHaveLength(3);
  expect(idempotencyKeys.every((key) => key.trim().length > 0)).toBe(true);
});
