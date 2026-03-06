import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render-with-providers';
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
});
