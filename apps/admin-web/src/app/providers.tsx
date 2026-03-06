import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from '../i18n';
import { queryClient } from './query-client';
import { appTheme } from './theme';

type Props = {
  children: ReactNode;
};

export function AppProviders({ children }: Props) {
  return (
    <I18nProvider>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
