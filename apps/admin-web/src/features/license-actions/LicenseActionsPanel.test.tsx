import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render-with-providers';

describe('LicenseActionsPanel', () => {
  it('locks action buttons when mutations are off', async () => {
    vi.stubEnv('VITE_ADMIN_WEB_ENABLE_MUTATIONS', 'false');
    const mod = await import('./LicenseActionsPanel');

    renderWithProviders(<mod.LicenseActionsPanel licenseKey="LIC-DEMO-123" />);

    expect(screen.getByText(/Mutacoes desabilitadas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Renovar$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Bloquear$/i })).toBeDisabled();
  }, 10000);
});
