import { screen } from '@testing-library/react';
import { getPublicVersion } from '../../app/runtime-config';
import { renderWithProviders } from '../../test/render-with-providers';
import { AppFrameHeader } from './AppFrameHeader';

describe('AppFrameHeader', () => {
  it('renders the public system version chip', () => {
    renderWithProviders(
      <AppFrameHeader
        title="Resumo"
        subtitle="Visao operacional"
        operator="ops-user"
        nowLabel="2026-03-25 21:00"
        onSignOut={() => undefined}
      />
    );

    expect(screen.getByText(`v${getPublicVersion()}`)).toBeInTheDocument();
  });
});
