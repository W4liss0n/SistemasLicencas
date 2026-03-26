import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render-with-providers';
import { server } from '../../test/server';
import { PlansPanel } from './PlansPanel';

describe('PlansPanel', () => {
  it('validates minimum one linked program on submit', async () => {
    vi.stubEnv('VITE_ADMIN_WEB_ENABLE_MUTATIONS', 'true');
    const user = userEvent.setup();

    renderWithProviders(<PlansPanel />);

    await user.click(screen.getByRole('button', { name: /Novo plano/i }));
    await user.type(screen.getByLabelText(/Nome do plano/i), 'Starter Plan');
    await user.click(screen.getByRole('button', { name: /Criar plano/i }));

    expect(await screen.findByText(/Selecione ao menos 1 programa/i)).toBeInTheDocument();
  });

  it('renders plans list from admin-api', async () => {
    renderWithProviders(<PlansPanel />);

    expect(await screen.findByText(/Planos cadastrados/i)).toBeInTheDocument();
    const basicEntries = await screen.findAllByText(/basic/i);
    expect(basicEntries.length).toBeGreaterThan(0);
  });

  it('edits an existing plan from the summary card', async () => {
    vi.stubEnv('VITE_ADMIN_WEB_ENABLE_MUTATIONS', 'true');
    const user = userEvent.setup();
    let capturedPayload: Record<string, unknown> | null = null;

    server.use(
      http.patch('/admin-api/plans/:planId', async ({ request }) => {
        capturedPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          plan: {
            id: '22222222-2222-4222-8222-222222222222',
            code: 'basic',
            name: 'Basic Updated',
            description: 'Descricao editada',
            max_devices: 3,
            max_offline_hours: 96,
            features: ['validate', 'analytics'],
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
      })
    );

    renderWithProviders(<PlansPanel />);

    await user.click(await screen.findByRole('button', { name: /Editar/i }));
    const nameInput = screen.getByLabelText(/Nome do plano/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Basic Updated');
    const maxOfflineInput = screen.getByLabelText(/Max offline hours/i);
    await user.clear(maxOfflineInput);
    await user.type(maxOfflineInput, '96');
    await user.click(screen.getByRole('button', { name: /Salvar plano/i }));

    await waitFor(() => {
      expect(capturedPayload).not.toBeNull();
    });

    expect(capturedPayload).toMatchObject({
      name: 'Basic Updated',
      max_offline_hours: 96,
      program_ids: ['11111111-1111-4111-8111-111111111111']
    });
    expect(await screen.findByText(/Plano atualizado com code basic/i)).toBeInTheDocument();
  });
});
