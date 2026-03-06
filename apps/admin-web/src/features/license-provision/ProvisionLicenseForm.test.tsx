import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render-with-providers';

describe('ProvisionLicenseForm', () => {
  it('shows warning and disabled submit when mutations are off', async () => {
    vi.stubEnv('VITE_ADMIN_WEB_ENABLE_MUTATIONS', 'false');
    const mod = await import('./ProvisionLicenseForm');

    renderWithProviders(<mod.ProvisionLicenseForm />);

    expect(screen.getByText(/Mutacoes desabilitadas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nova provisao/i })).toBeDisabled();
  }, 10000);
});
