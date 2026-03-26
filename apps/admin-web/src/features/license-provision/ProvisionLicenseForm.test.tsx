import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render-with-providers';
import { ProvisionLicenseForm } from './ProvisionLicenseForm';

describe('ProvisionLicenseForm', () => {
  it('shows warning and disabled submit when mutations are off', () => {
    vi.stubEnv('VITE_ADMIN_WEB_ENABLE_MUTATIONS', 'false');

    renderWithProviders(<ProvisionLicenseForm />);

    expect(screen.getByText(/Mutacoes desabilitadas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nova provisao/i })).toBeDisabled();
  });
});
