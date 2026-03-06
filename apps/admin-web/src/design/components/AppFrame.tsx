import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PeopleOutlineOutlinedIcon from '@mui/icons-material/PeopleOutlineOutlined';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
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
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { isMutationsEnabled } from '../../app/runtime-config';
import { clearOperatorName, getOperatorName } from '../../app/session';
import { useI18n } from '../../i18n';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

const navItems = [
  { serial: '01', labelKey: 'nav.dashboard', path: '/dashboard', icon: <DashboardOutlinedIcon fontSize="small" /> },
  { serial: '02', labelKey: 'nav.programs', path: '/programs', icon: <Inventory2OutlinedIcon fontSize="small" /> },
  { serial: '03', labelKey: 'nav.plans', path: '/plans', icon: <ViewListOutlinedIcon fontSize="small" /> },
  { serial: '04', labelKey: 'nav.customers', path: '/customers', icon: <PeopleOutlineOutlinedIcon fontSize="small" /> },
  { serial: '05', labelKey: 'nav.licenseSearch', path: '/licenses/search', icon: <KeyOutlinedIcon fontSize="small" /> },
  { serial: '06', labelKey: 'nav.licenseProvision', path: '/licenses/provision', icon: <PlaylistAddCheckIcon fontSize="small" /> }
];

function isItemActive(currentPath: string, itemPath: string): boolean {
  if (itemPath === '/licenses/search') {
    return currentPath.startsWith('/licenses/') && currentPath !== '/licenses/provision';
  }

  return currentPath === itemPath;
}

export function AppFrame({ title, subtitle, children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { formatDateTime, t } = useI18n();
  const operator = getOperatorName() || 'operator';
  const nowLabel = formatDateTime(new Date());
  const mutationsEnabled = isMutationsEnabled();
  const mutationLabel = mutationsEnabled ? t('frame.mutationsEnabled') : t('frame.mutationsDisabled');

  const signOut = () => {
    clearOperatorName();
    navigate('/login', { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100vh' }}>
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
            {navItems.map((item) => (
              <Button
                key={item.path}
                component={NavLink}
                to={item.path}
                aria-label={t(item.labelKey)}
                size="small"
                variant={isItemActive(location.pathname, item.path) ? 'contained' : 'outlined'}
                sx={{
                  flexShrink: 0,
                  borderColor: isItemActive(location.pathname, item.path)
                    ? 'transparent'
                    : 'var(--controlroom-border-soft)',
                  backgroundColor: isItemActive(location.pathname, item.path)
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

      <Box
        sx={{
          minHeight: { lg: '100vh' },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '304px minmax(0, 1fr)' }
        }}
      >
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
              {navItems.map((item) => (
                <ListItemButton
                  key={item.path}
                  component={NavLink}
                  to={item.path}
                  aria-label={t(item.labelKey)}
                  selected={isItemActive(location.pathname, item.path)}
                  sx={{
                    mb: 0.7,
                    px: 1.1,
                    py: 1.05,
                    alignItems: 'center',
                    borderColor: isItemActive(location.pathname, item.path)
                      ? 'var(--controlroom-border-emphasis)'
                      : 'var(--controlroom-border-soft)',
                    backgroundColor: isItemActive(location.pathname, item.path)
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
                  <Button size="small" variant="outlined" startIcon={<LogoutOutlinedIcon fontSize="small" />} onClick={signOut}>
                    {t('frame.signOut')}
                  </Button>
                </Stack>
              </Paper>
            </Box>
          </Stack>
        </Box>

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
          <Paper
            sx={{
              position: 'relative',
              overflow: 'hidden',
              p: { xs: 2, md: 2.5 },
              borderRadius: '24px',
              backgroundColor: 'var(--controlroom-surface)',
              borderColor: 'var(--controlroom-border-soft)',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: '0 auto 0 0',
                width: 3,
                backgroundColor: 'var(--controlroom-accent)',
                pointerEvents: 'none'
              }
            }}
          >
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', xl: 'row' }} justifyContent="space-between" sx={{ gap: 1.5 }}>
                <Stack spacing={0.7}>
                  <Typography variant="overline">{t('frame.adminPanel')}</Typography>
                  <Typography variant="h4">{title}</Typography>
                  {subtitle ? (
                    <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)', maxWidth: 760 }}>
                      {subtitle}
                    </Typography>
                  ) : null}
                </Stack>
                <Stack
                  direction="row"
                  spacing={0.75}
                  useFlexGap
                  flexWrap="wrap"
                  alignItems="center"
                  justifyContent={{ xs: 'flex-start', xl: 'flex-end' }}
                >
                  <Chip label={operator} size="small" className="mono" />
                  <Chip label={t('frame.updatedAt', { value: nowLabel })} size="small" />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<LogoutOutlinedIcon fontSize="small" />}
                    onClick={signOut}
                    sx={{ display: { xs: 'inline-flex', lg: 'none' } }}
                  >
                    {t('frame.signOut')}
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          </Paper>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
