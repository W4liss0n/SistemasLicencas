import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useI18n } from '../../i18n';

type Props = {
  title: string;
  subtitle?: string;
  operator: string;
  nowLabel: string;
  onSignOut: () => void;
};

export function AppFrameHeader({ title, subtitle, operator, nowLabel, onSignOut }: Props) {
  const { t } = useI18n();

  return (
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
              onClick={onSignOut}
              sx={{ display: { xs: 'inline-flex', lg: 'none' } }}
            >
              {t('frame.signOut')}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
