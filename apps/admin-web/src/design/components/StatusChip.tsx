import { Chip } from '@mui/material';

type Props = {
  status: string;
};

const palette = {
  active: { bg: 'var(--controlroom-success-surface)', fg: 'var(--controlroom-success)' },
  blocked: { bg: 'var(--controlroom-danger-surface)', fg: 'var(--controlroom-danger)' },
  cancelled: { bg: 'var(--controlroom-danger-surface)', fg: 'var(--controlroom-danger)' },
  inactive: { bg: 'var(--controlroom-warning-surface)', fg: 'var(--controlroom-warning)' },
  pending: { bg: 'var(--controlroom-accent-surface)', fg: 'var(--controlroom-accent)' }
};

export function StatusChip({ status }: Props) {
  const normalized = status.toLowerCase();
  const tone =
    normalized in palette
      ? palette[normalized as keyof typeof palette]
      : { bg: 'rgba(24, 95, 167, 0.12)', fg: 'var(--controlroom-accent)' };

  return (
    <Chip
      size="small"
      label={status.toUpperCase()}
      variant="outlined"
      sx={{
        borderRadius: '999px',
        px: 0.1,
        fontWeight: 700,
        letterSpacing: '0.03em',
        backgroundColor: tone.bg,
        color: tone.fg,
        borderColor: 'var(--controlroom-border-soft)'
      }}
    />
  );
}
