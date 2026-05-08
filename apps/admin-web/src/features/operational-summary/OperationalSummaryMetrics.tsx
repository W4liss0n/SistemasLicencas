import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type MetricCardProps = {
  title: string;
  value: number;
  helper: string;
  icon: ReactNode;
  accentColor: string;
  surfaceColor: string;
};

type RiskMetricProps = {
  label: string;
  value: number;
  maxValue: number;
  barColor: string;
};

type ThroughputRowProps = {
  label: string;
  value: number;
  accentColor: string;
};

export function MetricCard({
  title,
  value,
  helper,
  icon,
  accentColor,
  surfaceColor
}: MetricCardProps) {
  return (
    <Box
      sx={{
        height: '100%',
        p: 2,
        borderRadius: '18px',
        border: '1px solid var(--controlroom-border-soft)',
        backgroundColor: 'var(--controlroom-surface-elevated)'
      }}
    >
      <Stack spacing={1.35}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ gap: 1.25 }}>
          <Typography variant="subtitle2">{title}</Typography>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '14px',
              display: 'grid',
              placeItems: 'center',
              color: accentColor,
              backgroundColor: surfaceColor,
              border: '1px solid var(--controlroom-border-soft)'
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Typography variant="h4" className="mono" sx={{ lineHeight: 1 }}>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
          {helper}
        </Typography>
      </Stack>
    </Box>
  );
}

export function RiskMetric({ label, value, maxValue, barColor }: RiskMetricProps) {
  const normalized = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;

  return (
    <Box
      sx={{
        p: 1.4,
        borderRadius: '16px',
        border: '1px solid var(--controlroom-border-soft)',
        backgroundColor: 'var(--controlroom-surface-strong)'
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
            {label}
          </Typography>
          <Typography variant="subtitle2" className="mono">
            {value}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={normalized}
          sx={{
            height: 9,
            borderRadius: 999,
            backgroundColor: 'var(--controlroom-control)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 999,
              backgroundColor: barColor
            }
          }}
        />
      </Stack>
    </Box>
  );
}

export function ThroughputRow({ label, value, accentColor }: ThroughputRowProps) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.8, gap: 1 }}>
      <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
        {label}
      </Typography>
      <Chip
        size="small"
        label={value}
        className="mono"
        sx={{
          color: accentColor,
          backgroundColor: 'var(--controlroom-surface-elevated)'
        }}
      />
    </Stack>
  );
}
