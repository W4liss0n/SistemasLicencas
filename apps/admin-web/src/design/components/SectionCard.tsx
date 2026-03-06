import { Paper, Stack, Typography, type PaperProps } from '@mui/material';
import type { ReactNode } from 'react';

type Props = {
  children?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  elevated?: boolean;
} & PaperProps;

export function SectionCard({ children, title, subtitle, actions, elevated = false, sx, ...rest }: Props) {
  return (
    <Paper
      {...rest}
      sx={{
        position: 'relative',
        p: 2.25,
        borderRadius: 'var(--radius-md)',
        backgroundColor: elevated ? 'var(--controlroom-surface-elevated)' : 'var(--controlroom-surface)',
        border: elevated
          ? '1px solid var(--controlroom-border-strong)'
          : '1px solid var(--controlroom-border-soft)',
        ...sx
      }}
    >
      <Stack spacing={title || subtitle || actions ? 1.75 : 0}>
        {title || subtitle || actions ? (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'flex-start' }}
            sx={{ gap: 1.5 }}
          >
            <Stack spacing={0.35}>
              {typeof title === 'string' ? <Typography variant="h6">{title}</Typography> : title}
              {subtitle ? (
                typeof subtitle === 'string' ? (
                  <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                    {subtitle}
                  </Typography>
                ) : (
                  subtitle
                )
              ) : null}
            </Stack>
            {actions}
          </Stack>
        ) : null}
        {children ?? null}
      </Stack>
    </Paper>
  );
}
