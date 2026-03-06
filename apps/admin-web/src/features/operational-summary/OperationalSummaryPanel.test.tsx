import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OperationalSummaryPanel } from './OperationalSummaryPanel';
import { renderWithProviders } from '../../test/render-with-providers';

describe('OperationalSummaryPanel', () => {
  it('renders data from admin-api summary endpoint', async () => {
    renderWithProviders(<OperationalSummaryPanel />);

    expect(await screen.findByText(/Painel de estatisticas/i)).toBeInTheDocument();
    expect(await screen.findByText(/^Clientes$/i)).toBeInTheDocument();
    expect(await screen.findByText(/Licencas ativas/i)).toBeInTheDocument();
  });
});
