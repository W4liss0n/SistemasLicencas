import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render-with-providers';
import { server } from '../../test/server';
import { CustomersPanel } from './CustomersPanel';

describe('CustomersPanel', () => {
  it('expands customer accordion and renders license detail', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/admin-api/customers/99999999-9999-4999-8999-999999999999', () =>
        HttpResponse.json({
          success: true,
          customer: {
            id: '99999999-9999-4999-8999-999999999999',
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
      )
    );

    renderWithProviders(<CustomersPanel />);

    await user.click(await screen.findByText('Customer'));
    await user.click(screen.getByRole('tab', { name: 'Licencas' }));

    expect(await screen.findByText(/LIC-DEMO-ABC123/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/Basic \(basic\)/i)).length).toBeGreaterThan(0);
  });

  it('edits customer license contract fields from the license card', async () => {
    vi.stubEnv('VITE_ADMIN_WEB_ENABLE_MUTATIONS', 'true');
    const user = userEvent.setup();
    let capturedPayload: Record<string, unknown> | null = null;

    server.use(
      http.patch('/admin-api/licenses/:licenseKey', async ({ request, params }) => {
        capturedPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          license: {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            license_key: params.licenseKey,
            status: 'active',
            max_offline_hours: 96,
            transfer_count: 0,
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T12:00:00.000Z'
          },
          subscription: {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            status: 'active',
            start_at: '2026-03-05T10:00:00.000Z',
            end_at: '2027-04-05T10:00:00.000Z',
            auto_renew: true
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
      })
    );

    renderWithProviders(<CustomersPanel />);

    await user.click(await screen.findByText('Customer'));
    await user.click(screen.getByRole('tab', { name: 'Licencas' }));
    await user.click(await screen.findByRole('button', { name: /Editar/i }));

    const maxOfflineInput = screen.getByLabelText(/Maximo de horas offline/i);
    await user.clear(maxOfflineInput);
    await user.type(maxOfflineInput, '96');
    await user.click(screen.getByRole('switch', { name: /Renovacao automatica/i }));
    await user.click(screen.getByRole('button', { name: /Salvar licenca/i }));

    await waitFor(() => {
      expect(capturedPayload).not.toBeNull();
    });

    expect(capturedPayload).toMatchObject({
      auto_renew: true,
      max_offline_hours: 96
    });
    expect(typeof capturedPayload?.subscription_end_at).toBe('string');
  });

  it('creates customer only when Sem Plano is selected', async () => {
    vi.stubEnv('VITE_ADMIN_WEB_ENABLE_MUTATIONS', 'true');
    const user = userEvent.setup();
    let capturedPayload: Record<string, unknown> | null = null;

    server.use(
      http.post('/admin-api/customers', async ({ request }) => {
        capturedPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          customer: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            email: 'sem-plano@example.com',
            name: 'Cliente Sem Plano',
            document: null,
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T10:00:00.000Z'
          },
          end_user: {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            identifier: 'sem-plano@example.com',
            status: 'active',
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T10:00:00.000Z'
          }
        });
      })
    );

    renderWithProviders(<CustomersPanel />);

    await user.click(screen.getByRole('button', { name: /Novo onboarding/i }));
    await user.type(screen.getByLabelText(/Email do cliente/i), 'sem-plano@example.com');
    await user.type(screen.getByLabelText(/Nome do cliente/i), 'Cliente Sem Plano');
    await user.click(screen.getByRole('button', { name: /^Proximo$/i }));
    await user.click(screen.getByRole('button', { name: /^Proximo$/i }));
    await user.click(screen.getByRole('button', { name: /Confirmar cadastro/i }));

    await waitFor(() => {
      expect(capturedPayload).not.toBeNull();
    });

    expect(capturedPayload).toMatchObject({
      customer: {
        email: 'sem-plano@example.com',
        name: 'Cliente Sem Plano'
      }
    });
    expect(await screen.findByText(/Cliente cadastrado com sucesso/i)).toBeInTheDocument();
  });

  it('shows pending customers and prefills onboarding from the accordion CTA', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/admin-api/customers', () =>
        HttpResponse.json({
          success: true,
          items: [
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              email: 'pending@example.com',
              name: 'Pending Customer',
              document: null,
              created_at: '2026-03-05T10:00:00.000Z',
              updated_at: '2026-03-05T10:00:00.000Z',
              licenses_count: 0,
              last_subscription_status: null
            }
          ],
          page: 1,
          page_size: 20,
          total: 1
        })
      ),
      http.get('/admin-api/customers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', () =>
        HttpResponse.json({
          success: true,
          customer: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            email: 'pending@example.com',
            name: 'Pending Customer',
            document: null,
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T10:00:00.000Z'
          },
          licenses: []
        })
      )
    );

    renderWithProviders(<CustomersPanel />);

    expect(await screen.findByText(/Aguardando liberacao/i)).toBeInTheDocument();

    await user.click(screen.getByText('Pending Customer'));

    expect(await screen.findByText(/Cadastro pendente/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Liberar acesso/i }));

    expect(screen.getByRole('dialog', { name: /Onboarding de cliente/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email do cliente/i)).toHaveValue('pending@example.com');
    expect(screen.getByLabelText(/Nome do cliente/i)).toHaveValue('Pending Customer');
  });

  it('sends onboarding payload correctly from wizard for individual program mode', async () => {
    vi.stubEnv('VITE_ADMIN_WEB_ENABLE_MUTATIONS', 'true');
    const user = userEvent.setup();
    let capturedPayload: Record<string, unknown> | null = null;
    let capturedIdempotencyKey = '';

    server.use(
      http.post('/admin-api/customers/onboard', async ({ request }) => {
        capturedIdempotencyKey = request.headers.get('idempotency-key') ?? '';
        capturedPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          customer: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            email: 'wizard@example.com',
            name: 'Wizard User',
            document: null,
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T10:00:00.000Z'
          },
          end_user: {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            identifier: 'wizard@example.com',
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
            license_key: 'LIC-DEMO-XYZ123',
            status: 'active',
            max_offline_hours: 72,
            transfer_count: 0,
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T10:00:00.000Z'
          }
        });
      })
    );

    renderWithProviders(<CustomersPanel />);

    await user.click(screen.getByRole('button', { name: /Novo onboarding/i }));
    const dialog = screen.getByRole('dialog', { name: /Onboarding de cliente/i });
    await user.type(within(dialog).getByLabelText(/Email do cliente/i), 'wizard@example.com');
    await user.type(within(dialog).getByLabelText(/Nome do cliente/i), 'Wizard User');
    await user.click(within(dialog).getByRole('button', { name: /^Proximo$/i }));

    await user.click(within(dialog).getByRole('combobox', { name: /^Plano$/i }));
    await user.click(await screen.findByRole('option', { name: /Programa individual/i }));

    await user.click(within(dialog).getByRole('combobox', { name: /Programa individual/i }));
    await user.click(await screen.findByRole('option', { name: /Demo Program \(demo-program\)/i }));

    await user.click(within(dialog).getByRole('radio', { name: /Mensal/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Proximo$/i }));

    await user.click(within(dialog).getByRole('button', { name: /Confirmar onboarding/i }));

    await waitFor(() => {
      expect(capturedPayload).not.toBeNull();
      expect(capturedIdempotencyKey.length).toBeGreaterThan(0);
    });

    expect(capturedPayload?.customer).toMatchObject({
      email: 'wizard@example.com',
      name: 'Wizard User'
    });
    expect(capturedPayload?.selection_mode).toBe('individual_program');
    expect(capturedPayload?.program_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(capturedPayload?.plan_id).toBeUndefined();
    expect(typeof capturedPayload?.subscription_end_at).toBe('string');
    expect(await screen.findByText(/LIC-DEMO-XYZ123/i)).toBeInTheDocument();
  });

  it('omits program_id for a plan linked to a single program', async () => {
    vi.stubEnv('VITE_ADMIN_WEB_ENABLE_MUTATIONS', 'true');
    const user = userEvent.setup();
    let capturedPayload: Record<string, unknown> | null = null;

    server.use(
      http.post('/admin-api/customers/onboard', async ({ request }) => {
        capturedPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          customer: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            email: 'plan@example.com',
            name: 'Plan User',
            document: null,
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T10:00:00.000Z'
          },
          end_user: {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            identifier: 'plan@example.com',
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
            license_key: 'LIC-DEMO-PLAN123',
            status: 'active',
            max_offline_hours: 72,
            transfer_count: 0,
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T10:00:00.000Z'
          }
        });
      })
    );

    renderWithProviders(<CustomersPanel />);

    await user.click(screen.getByRole('button', { name: /Novo onboarding/i }));
    const dialog = screen.getByRole('dialog', { name: /Onboarding de cliente/i });
    await user.type(within(dialog).getByLabelText(/Email do cliente/i), 'plan@example.com');
    await user.type(within(dialog).getByLabelText(/Nome do cliente/i), 'Plan User');
    await user.click(within(dialog).getByRole('button', { name: /^Proximo$/i }));

    await user.click(within(dialog).getByRole('combobox', { name: /^Plano$/i }));
    await user.click(await screen.findByRole('option', { name: /Basic \(basic\)/i }));
    expect(within(dialog).queryByRole('combobox', { name: /^Programa$/i })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^Proximo$/i }));
    await user.click(within(dialog).getByRole('button', { name: /Confirmar onboarding/i }));

    await waitFor(() => {
      expect(capturedPayload).not.toBeNull();
    });

    expect(capturedPayload?.selection_mode).toBe('plan');
    expect(capturedPayload?.plan_id).toBe('22222222-2222-4222-8222-222222222222');
    expect(capturedPayload?.program_id).toBeUndefined();
  });
});
