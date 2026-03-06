import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render-with-providers';
import { server } from '../../test/server';
import { ProgramsPanel } from './ProgramsPanel';

describe('ProgramsPanel', () => {
  it('renders list items from admin-api', async () => {
    renderWithProviders(<ProgramsPanel />);

    expect(await screen.findByText(/Programas cadastrados/i)).toBeInTheDocument();
    expect(await screen.findByText(/demo-program/i)).toBeInTheDocument();
  });

  it('submits create request with idempotency key header', async () => {
    vi.stubEnv('VITE_ADMIN_WEB_ENABLE_MUTATIONS', 'true');
    const user = userEvent.setup();
    let receivedIdempotencyKey = '';

    server.use(
      http.post('/admin-api/programs', async ({ request }) => {
        receivedIdempotencyKey = request.headers.get('idempotency-key') ?? '';
        return HttpResponse.json({
          success: true,
          program: {
            id: '12121212-1212-4121-8121-121212121212',
            code: 'desktop-agent-aa11',
            name: 'Desktop Agent',
            description: null,
            status: 'active',
            metadata: {},
            created_at: '2026-03-05T10:00:00.000Z',
            updated_at: '2026-03-05T10:00:00.000Z'
          }
        });
      })
    );

    renderWithProviders(<ProgramsPanel />);

    await user.click(screen.getByRole('button', { name: /Novo programa/i }));
    await user.type(screen.getByLabelText(/Nome do programa/i), 'Desktop Agent');
    await user.click(screen.getByRole('button', { name: /Criar programa/i }));

    await waitFor(() => {
      expect(receivedIdempotencyKey.length).toBeGreaterThan(0);
    });
    expect(await screen.findByText(/desktop-agent-aa11/i)).toBeInTheDocument();
  });
});
