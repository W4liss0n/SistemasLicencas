import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { NavLink } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { appFrameNavItems, isAppFrameNavItemActive } from './AppFrameNavigation';

type Props = {
  currentPath: string;
  operator: string;
  mutationLabel: string;
  mutationsEnabled: boolean;
};

export function AppFrameMobileNav({
  currentPath,
  operator,
  mutationLabel,
  mutationsEnabled
}: Props) {
  const { t } = useI18n();

  return (
    <Box sx={{ display: { xs: 'block', lg: 'none' }, px: 1.5, pt: 1.5 }}>
      <Paper
        sx={{
          p: 1.75,
          borderRadius: '20px',
          backgroundColor: 'var(--controlroom-surface)'
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ gap: 1.25 }}>
            <Stack spacing={0.35}>
              <Typography variant="overline">{t('frame.controlRoom')}</Typography>
              <Typography variant="subtitle1">{t('frame.backoffice')}</Typography>
              <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                {t('frame.operations')}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" justifyContent="flex-end">
              <Chip size="small" label={operator} className="mono" />
              <Chip
                size="small"
                label={mutationLabel}
                sx={{
                  color: mutationsEnabled ? 'var(--controlroom-success)' : 'var(--controlroom-warning)',
                  backgroundColor: mutationsEnabled
                    ? 'var(--controlroom-success-surface)'
                    : 'var(--controlroom-warning-surface)'
                }}
              />
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.25 }}>
            {appFrameNavItems.map((item) => (
              <Button
                key={item.path}
                component={NavLink}
                to={item.path}
                aria-label={t(item.labelKey)}
                size="small"
                variant={isAppFrameNavItemActive(currentPath, item.path) ? 'contained' : 'outlined'}
                sx={{
                  flexShrink: 0,
                  borderColor: isAppFrameNavItemActive(currentPath, item.path)
                    ? 'transparent'
                    : 'var(--controlroom-border-soft)',
                  backgroundColor: isAppFrameNavItemActive(currentPath, item.path)
                    ? undefined
                    : 'var(--controlroom-surface-elevated)'
                }}
              >
                {t(item.labelKey)}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
