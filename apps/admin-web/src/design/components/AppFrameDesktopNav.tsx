import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import {
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import { NavLink } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { appFrameNavItems, isAppFrameNavItemActive } from './AppFrameNavigation';

type Props = {
  currentPath: string;
  operator: string;
  mutationLabel: string;
  mutationsEnabled: boolean;
  nowLabel: string;
  onSignOut: () => void;
};

export function AppFrameDesktopNav({
  currentPath,
  operator,
  mutationLabel,
  mutationsEnabled,
  nowLabel,
  onSignOut
}: Props) {
  const { t } = useI18n();

  return (
    <Box
      component="aside"
      sx={{
        display: { xs: 'none', lg: 'block' },
        position: 'sticky',
        top: 0,
        alignSelf: 'start',
        minHeight: '100vh',
        borderRight: '1px solid var(--controlroom-border-soft)'
      }}
    >
      <Stack spacing={2.25} sx={{ px: 2.25, py: 2.5, height: '100%' }}>
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            p: 2.25,
            borderRadius: '24px',
            border: '1px solid var(--controlroom-border-soft)',
            backgroundColor: 'var(--controlroom-surface)'
          }}
        >
          <Stack spacing={1.5}>
            <Stack spacing={0.4}>
              <Typography variant="overline">{t('frame.controlRoom')}</Typography>
              <Typography variant="h6">{t('frame.backoffice')}</Typography>
              <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                {t('frame.operations')}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
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
        </Box>

        <Stack spacing={0.65}>
          <Typography variant="caption" className="mono" sx={{ color: 'var(--controlroom-ink-muted)', px: 1 }}>
            NAV 06
          </Typography>
          <List disablePadding>
            {appFrameNavItems.map((item) => (
              <ListItemButton
                key={item.path}
                component={NavLink}
                to={item.path}
                aria-label={t(item.labelKey)}
                selected={isAppFrameNavItemActive(currentPath, item.path)}
                sx={{
                  mb: 0.7,
                  px: 1.1,
                  py: 1.05,
                  alignItems: 'center',
                  borderColor: isAppFrameNavItemActive(currentPath, item.path)
                    ? 'var(--controlroom-border-emphasis)'
                    : 'var(--controlroom-border-soft)',
                  backgroundColor: isAppFrameNavItemActive(currentPath, item.path)
                    ? 'var(--controlroom-accent-surface)'
                    : 'transparent'
                }}
              >
                <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={t(item.labelKey)} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
                <Typography
                  variant="caption"
                  className="mono"
                  aria-hidden="true"
                  sx={{ color: 'var(--controlroom-ink-muted)' }}
                >
                  {item.serial}
                </Typography>
              </ListItemButton>
            ))}
          </List>
        </Stack>

        <Box sx={{ mt: 'auto' }}>
          <Paper
            sx={{
              p: 1.75,
              borderRadius: '20px',
              backgroundColor: 'var(--controlroom-surface-elevated)',
              borderColor: 'var(--controlroom-border-soft)'
            }}
          >
            <Stack spacing={1}>
              <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                {t('frame.activeSession')}
              </Typography>
              <Typography variant="body2" className="mono">
                {operator}
              </Typography>
              <Divider />
              <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                {t('frame.updatedAt', { value: nowLabel })}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<LogoutOutlinedIcon fontSize="small" />}
                onClick={onSignOut}
              >
                {t('frame.signOut')}
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Stack>
    </Box>
  );
}
