import { expect, test } from '@playwright/test';

test('dashboard flow with mocked internal api', async ({ page }) => {
  await page.route('**/admin-api/operational-summary**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generated_at: '2026-03-05T10:00:00.000Z',
        window_days: 7,
        totals: {
          customers: 4,
          subscriptions_active: 3,
          licenses: 6,
          licenses_active: 5,
          devices_active: 9
        },
        recent: {
          validation_failures: 1,
          security_events_critical: 0,
          transfer_events: 2,
          deactivate_events: 0
        }
      })
    });
  });

  await page.goto('/login');
  const operatorInput = page.getByRole('textbox', { name: 'Operador' });
  await operatorInput.fill('ops-user');
  await expect(operatorInput).toHaveValue('ops-user');
  await page.getByRole('button', { name: 'Entrar no control room' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Resumo Operacional' })).toBeVisible();
  await expect(page.getByText('Painel de estatisticas')).toBeVisible();
  await expect(page.getByText('Base registrada no backoffice.')).toBeVisible();
});
