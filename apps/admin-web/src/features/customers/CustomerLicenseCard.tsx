import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, Chip, Divider, Grid, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { isMutationsEnabled } from '../../app/runtime-config';
import { SectionCard } from '../../design/components/SectionCard';
import { useI18n } from '../../i18n';
import type { AdminCustomerDetailsResponse } from '../../types/api';
import { CustomerLicenseEditDialog } from './CustomerLicenseEditDialog';

type CustomerLicenseEntry = AdminCustomerDetailsResponse['licenses'][number];

type Props = {
  customerId: string;
  entry: CustomerLicenseEntry;
};

function statusColor(status: string): { color: string; backgroundColor: string } {
  switch (status) {
    case 'active':
      return {
        color: 'var(--controlroom-success)',
        backgroundColor: 'var(--controlroom-success-surface)'
      };
    case 'blocked':
    case 'inactive':
    case 'cancelled':
    case 'expired':
      return {
        color: 'var(--controlroom-warning)',
        backgroundColor: 'var(--controlroom-warning-surface)'
      };
    default:
      return {
        color: 'var(--controlroom-ink-secondary)',
        backgroundColor: 'var(--controlroom-surface-strong)'
      };
  }
}

export function CustomerLicenseCard({ customerId, entry }: Props) {
  const { formatDateTime, t } = useI18n();
  const mutationsEnabled = isMutationsEnabled();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const subscriptionStatus = statusColor(entry.subscription.status);
  const licenseStatus = statusColor(entry.license.status);
  const activeDevices = entry.devices.filter((device) => device.is_active).length;
  const infoPanelSx = {
    p: 1.25,
    borderRadius: '14px',
    border: '1px solid var(--controlroom-border-soft)',
    backgroundColor: 'var(--controlroom-surface)'
  };

  return (
    <>
      <SectionCard
        elevated
        actions={
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditOutlinedIcon />}
            onClick={() => setIsEditOpen(true)}
            disabled={!mutationsEnabled}
          >
            {t('common.edit')}
          </Button>
        }
        sx={{
          backgroundColor: 'var(--controlroom-surface-elevated)'
        }}
      >
        <Stack spacing={1.4}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" sx={{ gap: 1 }}>
            <Stack spacing={0.6}>
              <Typography variant="subtitle2" className="mono">
                {entry.license.license_key}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                {entry.plan.name} ({entry.plan.code})
              </Typography>
            </Stack>

            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Chip
                size="small"
                label={t('customers.detail.licenseStatusValue', { value: entry.license.status })}
                sx={licenseStatus}
              />
              <Chip
                size="small"
                label={t('customers.detail.subscriptionStatusValue', { value: entry.subscription.status })}
                sx={subscriptionStatus}
              />
            </Stack>
          </Stack>

          <Divider />

          <Grid container spacing={1.2}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Box sx={infoPanelSx}>
                <Stack spacing={0.7}>
                  <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                    {t('customers.detail.planSection')}
                  </Typography>
                  <Typography variant="body2">
                    {entry.plan.name} ({entry.plan.code})
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                    {t('customers.detail.maxDevicesValue', { value: entry.plan.max_devices })}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                    {t('customers.detail.maxOfflineValue', { value: entry.plan.max_offline_hours })}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                    <strong>{t('customers.detail.licenseMaxOffline')}:</strong>{' '}
                    {t('customers.detail.maxOfflineValue', { value: entry.license.max_offline_hours })}
                  </Typography>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    {entry.programs.map((program) => (
                      <Chip key={program.id} size="small" label={program.name} />
                    ))}
                  </Stack>
                </Stack>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }}>
              <Box sx={infoPanelSx}>
                <Stack spacing={0.7}>
                  <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                    {t('customers.detail.subscriptionSection')}
                  </Typography>
                  <Typography variant="body2">
                    <strong>{t('customers.detail.startAt')}:</strong> {formatDateTime(new Date(entry.subscription.start_at))}
                  </Typography>
                  <Typography variant="body2">
                    <strong>{t('customers.detail.endAt')}:</strong> {formatDateTime(new Date(entry.subscription.end_at))}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                    <strong>{t('customers.detail.autoRenew')}:</strong>{' '}
                    {entry.subscription.auto_renew
                      ? t('customers.detail.autoRenewOn')
                      : t('customers.detail.autoRenewOff')}
                  </Typography>
                </Stack>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }}>
              <Box sx={infoPanelSx}>
                <Stack spacing={0.7}>
                  <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                    {t('customers.detail.devicesSection')}
                  </Typography>
                  {entry.devices.length > 0 ? (
                    <Typography variant="body2">
                      {t('customers.detail.deviceCountValue', {
                        active: activeDevices,
                        total: entry.devices.length
                      })}
                    </Typography>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                      {t('customers.detail.devicesEmpty')}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Grid>
          </Grid>

          {entry.devices.length > 0 ? (
            <Stack spacing={0.8}>
              {entry.devices.map((device) => (
                <Box
                  key={device.id}
                  sx={{
                    p: 1,
                    borderRadius: '12px',
                    border: '1px solid var(--controlroom-border-soft)',
                    backgroundColor: 'var(--controlroom-surface)'
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    sx={{ gap: 0.9 }}
                  >
                    <Stack spacing={0.35}>
                      <Typography variant="body2" className="mono">
                        {device.fingerprint_hash}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                        {device.match_source}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--controlroom-ink-muted)' }}>
                        {device.last_seen_at
                          ? `${t('customers.detail.lastSeen')}: ${formatDateTime(new Date(device.last_seen_at))}`
                          : t('customers.detail.lastSeenEmpty')}
                      </Typography>
                    </Stack>
                    <Chip
                      size="small"
                      label={device.is_active ? t('customers.detail.deviceActive') : t('customers.detail.deviceInactive')}
                      sx={
                        device.is_active
                          ? {
                              color: 'var(--controlroom-success)',
                              backgroundColor: 'var(--controlroom-success-surface)'
                            }
                          : {
                              color: 'var(--controlroom-warning)',
                              backgroundColor: 'var(--controlroom-warning-surface)'
                            }
                      }
                    />
                  </Stack>
                </Box>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </SectionCard>

      <CustomerLicenseEditDialog
        customerId={customerId}
        entry={entry}
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />
    </>
  );
}
