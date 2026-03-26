import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isMutationsEnabled } from '../../app/runtime-config';
import {
  clearOperatorContextName,
  getOperatorContextName
} from '../../app/session';
import { useI18n } from '../../i18n';
import { AppFrameDesktopNav } from './AppFrameDesktopNav';
import { AppFrameHeader } from './AppFrameHeader';
import { AppFrameMobileNav } from './AppFrameMobileNav';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function AppFrame({ title, subtitle, children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { formatDateTime, t } = useI18n();
  const operator = getOperatorContextName() || 'operator';
  const nowLabel = formatDateTime(new Date());
  const mutationsEnabled = isMutationsEnabled();
  const mutationLabel = mutationsEnabled ? t('frame.mutationsEnabled') : t('frame.mutationsDisabled');

  const signOut = () => {
    clearOperatorContextName();
    navigate('/login', { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppFrameMobileNav
        currentPath={location.pathname}
        operator={operator}
        mutationLabel={mutationLabel}
        mutationsEnabled={mutationsEnabled}
      />

      <Box
        sx={{
          minHeight: { lg: '100vh' },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '304px minmax(0, 1fr)' }
        }}
      >
        <AppFrameDesktopNav
          currentPath={location.pathname}
          operator={operator}
          mutationLabel={mutationLabel}
          mutationsEnabled={mutationsEnabled}
          nowLabel={nowLabel}
          onSignOut={signOut}
        />

        <Box
          component="main"
          sx={{
            minWidth: 0,
            px: { xs: 1.5, md: 2.5, xl: 3 },
            pt: { xs: 1.5, md: 2.25 },
            pb: { xs: 2, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5
          }}
        >
          <AppFrameHeader
            title={title}
            subtitle={subtitle}
            operator={operator}
            nowLabel={nowLabel}
            onSignOut={signOut}
          />
          {children}
        </Box>
      </Box>
    </Box>
  );
}
