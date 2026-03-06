import DevicesOutlinedIcon from '@mui/icons-material/DevicesOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import PeopleOutlineOutlinedIcon from '@mui/icons-material/PeopleOutlineOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import SubscriptionsOutlinedIcon from '@mui/icons-material/SubscriptionsOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Alert,
  Box,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Typography
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { SectionCard } from '../../design/components/SectionCard';
import { useI18n } from '../../i18n';
import type { AdminOperationalSummaryResponse } from '../../types/api';
import { getOperationalSummary, queryKeys } from '../api';

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

type HealthState = {
  labelKey: string;
  helperKey: string;
  accentColor: string;
  surfaceColor: string;
};

function MetricCard({
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

function RiskMetric({ label, value, maxValue, barColor }: RiskMetricProps) {
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

function ThroughputRow({ label, value, accentColor }: ThroughputRowProps) {
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

function buildHealthState(summary: AdminOperationalSummaryResponse): HealthState {
  const recent = summary.recent;
  const riskScore =
    recent.validation_failures +
    recent.transfer_events +
    recent.deactivate_events +
    recent.security_events_critical * 4;

  if (recent.security_events_critical > 0 || riskScore >= 8) {
    return {
      labelKey: 'dashboard.health.critical',
      helperKey: 'dashboard.health.criticalHelper',
      accentColor: 'var(--controlroom-danger)',
      surfaceColor: 'var(--controlroom-danger-surface)'
    };
  }

  if (riskScore >= 3) {
    return {
      labelKey: 'dashboard.health.attention',
      helperKey: 'dashboard.health.attentionHelper',
      accentColor: 'var(--controlroom-warning)',
      surfaceColor: 'var(--controlroom-warning-surface)'
    };
  }

  return {
    labelKey: 'dashboard.health.stable',
    helperKey: 'dashboard.health.stableHelper',
    accentColor: 'var(--controlroom-success)',
    surfaceColor: 'var(--controlroom-success-surface)'
  };
}

function buildThroughputLabel(summary: AdminOperationalSummaryResponse): string {
  const recent = summary.recent;

  if (recent.security_events_critical > 0) {
    return 'dashboard.throughput.escalate';
  }

  if (recent.validation_failures > 0 || recent.transfer_events > 1 || recent.deactivate_events > 0) {
    return 'dashboard.throughput.watch';
  }

  return 'dashboard.throughput.none';
}

export function OperationalSummaryPanel() {
  const [windowDays, setWindowDays] = useState(7);
  const { formatDateTime, t } = useI18n();

  const summaryQuery = useQuery({
    queryKey: queryKeys.summary(windowDays),
    queryFn: () => getOperationalSummary(windowDays)
  });

  const riskMax = useMemo(() => {
    if (summaryQuery.status !== 'success') {
      return 0;
    }

    const values = [
      summaryQuery.data.recent.validation_failures,
      summaryQuery.data.recent.security_events_critical,
      summaryQuery.data.recent.transfer_events,
      summaryQuery.data.recent.deactivate_events
    ];

    return Math.max(...values, 1);
  }, [summaryQuery]);

  const healthState = useMemo(() => {
    if (summaryQuery.status !== 'success') {
      return null;
    }

    return buildHealthState(summaryQuery.data);
  }, [summaryQuery]);

  const throughputLabelKey = useMemo(() => {
    if (summaryQuery.status !== 'success') {
      return null;
    }

    return buildThroughputLabel(summaryQuery.data);
  }, [summaryQuery]);

  const windowControl = (
    <FormControl size="small" sx={{ minWidth: 146 }}>
      <InputLabel id="window-days">{t('dashboard.window.label')}</InputLabel>
      <Select
        labelId="window-days"
        label={t('dashboard.window.label')}
        value={windowDays}
        onChange={(event) => setWindowDays(Number(event.target.value))}
      >
        <MenuItem value={1}>{t('dashboard.window.1')}</MenuItem>
        <MenuItem value={7}>{t('dashboard.window.7')}</MenuItem>
        <MenuItem value={15}>{t('dashboard.window.15')}</MenuItem>
        <MenuItem value={30}>{t('dashboard.window.30')}</MenuItem>
      </Select>
    </FormControl>
  );

  return (
    <Stack spacing={2}>
      <SectionCard title={t('dashboard.kpis.title')} subtitle={t('dashboard.kpis.subtitle')} actions={windowControl}>
        {summaryQuery.status === 'pending' ? (
          <Grid container spacing={2}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Grid key={`summary-loading-${index}`} size={{ xs: 12, sm: 6, xl: 3 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: '18px',
                    border: '1px solid var(--controlroom-border-soft)',
                    backgroundColor: 'var(--controlroom-surface-strong)'
                  }}
                >
                  <Stack spacing={1.4}>
                    <Skeleton variant="text" width={68} height={18} />
                    <Skeleton variant="text" width={116} height={28} />
                    <Skeleton variant="text" width="72%" height={18} />
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        ) : null}

        {summaryQuery.status === 'error' ? <Alert severity="error">{t('dashboard.errorSummary')}</Alert> : null}

        {summaryQuery.status === 'success' ? (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }} sx={{ gap: 1 }}>
              <Stack spacing={0.55}>
                <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                  {t('dashboard.risk.windowSummary', { value: summaryQuery.data.window_days })}
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                  {t('dashboard.generatedAt', { value: formatDateTime(new Date(summaryQuery.data.generated_at)) })}
                </Typography>
              </Stack>
              {healthState ? (
                <Chip
                  icon={<ShieldOutlinedIcon fontSize="small" />}
                  label={t(healthState.labelKey)}
                  sx={{
                    alignSelf: { xs: 'flex-start', lg: 'auto' },
                    color: healthState.accentColor,
                    backgroundColor: healthState.surfaceColor
                  }}
                />
              ) : null}
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <MetricCard
                  title={t('dashboard.kpi.customers')}
                  value={summaryQuery.data.totals.customers}
                  helper={t('dashboard.kpi.customersHelper')}
                  icon={<PeopleOutlineOutlinedIcon fontSize="small" />}
                  accentColor="var(--controlroom-accent)"
                  surfaceColor="var(--controlroom-accent-surface)"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <MetricCard
                  title={t('dashboard.kpi.activeSubscriptions')}
                  value={summaryQuery.data.totals.subscriptions_active}
                  helper={t('dashboard.kpi.activeSubscriptionsHelper')}
                  icon={<SubscriptionsOutlinedIcon fontSize="small" />}
                  accentColor="var(--controlroom-signal-cyan)"
                  surfaceColor="var(--controlroom-signal-cyan-surface)"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <MetricCard
                  title={t('dashboard.kpi.activeLicenses')}
                  value={summaryQuery.data.totals.licenses_active}
                  helper={t('dashboard.kpi.activeLicensesHelper', {
                    active: summaryQuery.data.totals.licenses_active,
                    total: summaryQuery.data.totals.licenses
                  })}
                  icon={<KeyOutlinedIcon fontSize="small" />}
                  accentColor="var(--controlroom-warning)"
                  surfaceColor="var(--controlroom-warning-surface)"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <MetricCard
                  title={t('dashboard.kpi.activeDevices')}
                  value={summaryQuery.data.totals.devices_active}
                  helper={t('dashboard.kpi.activeDevicesHelper')}
                  icon={<DevicesOutlinedIcon fontSize="small" />}
                  accentColor="var(--controlroom-success)"
                  surfaceColor="var(--controlroom-success-surface)"
                />
              </Grid>
            </Grid>
          </Stack>
        ) : null}
      </SectionCard>

      {summaryQuery.status === 'pending' ? (
        <Grid container spacing={2}>
          {Array.from({ length: 2 }).map((_, index) => (
            <Grid key={`detail-loading-${index}`} size={{ xs: 12, xl: 6 }}>
              <SectionCard>
                <Stack spacing={1.25}>
                  <Skeleton variant="text" width={170} height={26} />
                  <Skeleton variant="text" width="78%" height={18} />
                  <Skeleton variant="rounded" width="100%" height={120} />
                </Stack>
              </SectionCard>
            </Grid>
          ))}
        </Grid>
      ) : null}

      {summaryQuery.status === 'success' ? (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, xl: 7 }}>
            <SectionCard
              title={t('dashboard.risk.title')}
              subtitle={t('dashboard.risk.subtitle')}
              actions={
                healthState ? (
                  <Chip
                    size="small"
                    label={t(healthState.labelKey)}
                    sx={{
                      color: healthState.accentColor,
                      backgroundColor: healthState.surfaceColor
                    }}
                  />
                ) : null
              }
            >
              <Stack spacing={1.5}>
                <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                  {healthState ? t(healthState.helperKey) : ''}
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <RiskMetric
                      label={t('dashboard.risk.validationFailures')}
                      value={summaryQuery.data.recent.validation_failures}
                      maxValue={riskMax}
                      barColor="var(--controlroom-warning)"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <RiskMetric
                      label={t('dashboard.risk.criticalEvents')}
                      value={summaryQuery.data.recent.security_events_critical}
                      maxValue={riskMax}
                      barColor="var(--controlroom-danger)"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <RiskMetric
                      label={t('dashboard.risk.transfers')}
                      value={summaryQuery.data.recent.transfer_events}
                      maxValue={riskMax}
                      barColor="var(--controlroom-info)"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <RiskMetric
                      label={t('dashboard.risk.deactivations')}
                      value={summaryQuery.data.recent.deactivate_events}
                      maxValue={riskMax}
                      barColor="var(--controlroom-accent)"
                    />
                  </Grid>
                </Grid>
                <Stack direction="row" justifyContent="space-between" sx={{ gap: 1 }}>
                  <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                    {t('dashboard.risk.baseLabel')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                    {t('dashboard.risk.peakLabel')}
                  </Typography>
                </Stack>
              </Stack>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12, xl: 5 }}>
            <SectionCard
              title={t('dashboard.throughput.title')}
              subtitle={t('dashboard.throughput.subtitle')}
              actions={
                <Chip
                  size="small"
                  icon={<WarningAmberRoundedIcon fontSize="small" />}
                  label={throughputLabelKey ? t(throughputLabelKey) : ''}
                  sx={{
                    color:
                      throughputLabelKey === 'dashboard.throughput.none'
                        ? 'var(--controlroom-success)'
                        : throughputLabelKey === 'dashboard.throughput.watch'
                          ? 'var(--controlroom-warning)'
                          : 'var(--controlroom-danger)',
                    backgroundColor:
                      throughputLabelKey === 'dashboard.throughput.none'
                        ? 'var(--controlroom-success-surface)'
                        : throughputLabelKey === 'dashboard.throughput.watch'
                          ? 'var(--controlroom-warning-surface)'
                          : 'var(--controlroom-danger-surface)'
                  }}
                />
              }
            >
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                  <Box
                    sx={{
                      flex: 1,
                      p: 1.5,
                      borderRadius: '16px',
                      border: '1px solid var(--controlroom-border-soft)',
                      backgroundColor: 'var(--controlroom-surface-strong)'
                    }}
                  >
                    <Stack spacing={0.65}>
                      <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                        {t('dashboard.throughput.transfers')}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <SwapHorizOutlinedIcon fontSize="small" sx={{ color: 'var(--controlroom-info)' }} />
                        <Typography variant="h4" className="mono" sx={{ lineHeight: 1 }}>
                          {summaryQuery.data.recent.transfer_events}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>

                  <Box
                    sx={{
                      flex: 1,
                      p: 1.5,
                      borderRadius: '16px',
                      border: '1px solid var(--controlroom-border-soft)',
                      backgroundColor: 'var(--controlroom-surface-strong)'
                    }}
                  >
                    <Stack spacing={0.65}>
                      <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                        {t('dashboard.throughput.deactivations')}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <WarningAmberRoundedIcon fontSize="small" sx={{ color: 'var(--controlroom-warning)' }} />
                        <Typography variant="h4" className="mono" sx={{ lineHeight: 1 }}>
                          {summaryQuery.data.recent.deactivate_events}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                </Stack>

                <Divider sx={{ borderColor: 'var(--controlroom-border-soft)' }} />

                <Stack spacing={0.35}>
                  <ThroughputRow
                    label={t('dashboard.throughput.validation')}
                    value={summaryQuery.data.recent.validation_failures}
                    accentColor="var(--controlroom-warning)"
                  />
                  <ThroughputRow
                    label={t('dashboard.throughput.critical')}
                    value={summaryQuery.data.recent.security_events_critical}
                    accentColor="var(--controlroom-danger)"
                  />
                </Stack>
              </Stack>
            </SectionCard>
          </Grid>
        </Grid>
      ) : null}
    </Stack>
  );
}
