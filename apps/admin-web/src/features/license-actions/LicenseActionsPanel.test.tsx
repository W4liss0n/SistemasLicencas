import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render-with-providers';
import { LicenseActionsPanel } from './LicenseActionsPanel';

describe('LicenseActionsPanel', () => {
  it('locks action buttons when mutations are off', () => {
    vi.stubEnv('VITE_ADMIN_WEB_ENABLE_MUTATIONS', 'false');

    renderWithProviders(<LicenseActionsPanel licenseKey="LIC-DEMO-123" />);

    expect(screen.getByText(/Mutacoes desabilitadas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Renovar$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Bloquear$/i })).toBeDisabled();
  });
});
