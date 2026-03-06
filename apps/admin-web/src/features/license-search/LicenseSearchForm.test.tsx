import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LicenseSearchForm } from './LicenseSearchForm';
import { renderWithProviders } from '../../test/render-with-providers';

describe('LicenseSearchForm', () => {
  it('renders search input and button', () => {
    renderWithProviders(
      <MemoryRouter>
        <LicenseSearchForm />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/Chave da licenca/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buscar/i })).toBeInTheDocument();
  });

  it('accepts license key input', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter>
        <LicenseSearchForm />
      </MemoryRouter>
    );

    const input = screen.getByLabelText(/Chave da licenca/i);
    await user.type(input, 'LIC-DEMO-123');
    expect(input).toHaveValue('LIC-DEMO-123');
  });
});
