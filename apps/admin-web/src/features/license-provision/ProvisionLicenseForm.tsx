import { zodResolver } from '@hookform/resolvers/zod';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { queryClient } from '../../app/query-client';
import { isMutationsEnabled } from '../../app/runtime-config';
import { getOperatorName } from '../../app/session';
import { SectionCard } from '../../design/components/SectionCard';
import { useI18n } from '../../i18n';
import { ApiError } from '../../lib/http/api-error';
import { createIdempotencyKey } from '../../lib/idempotency/create-idempotency-key';
import { appendOperationTrail } from '../../lib/trail/operation-trail';
import type { ProvisionLicensePayload } from '../../types/api';
import { provisionLicense, queryKeys } from '../api';

const provisionSchema = z.object({
  program_code: z.string().min(2),
  plan_code: z.string().min(2),
  email: z.string().email(),
  name: z.string().min(2),
  document: z.string().optional(),
  subscription_end_at: z.string().min(10),
  subscription_start_at: z.string().optional(),
  auto_renew: z.boolean(),
  max_offline_hours: z.number().int().min(1).max(720).optional()
});

type ProvisionFormValues = z.infer<typeof provisionSchema>;

export function ProvisionLicenseForm() {
  const operator = getOperatorName() || 'operator';
  const mutationsEnabled = isMutationsEnabled();
  const [createdLicenseKey, setCreatedLicenseKey] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { t } = useI18n();

  const form = useForm<ProvisionFormValues>({
    resolver: zodResolver(provisionSchema),
    defaultValues: {
      program_code: 'demo-program',
      plan_code: 'basic',
      email: '',
      name: '',
      document: '',
      subscription_end_at: '',
      subscription_start_at: '',
      auto_renew: false,
      max_offline_hours: 72
    }
  });

  const mutation = useMutation({
    mutationFn: async (values: ProvisionFormValues) => {
      const payload: ProvisionLicensePayload = {
        program_code: values.program_code,
        plan_code: values.plan_code,
        customer: {
          email: values.email,
          name: values.name,
          document: values.document || undefined
        },
        subscription_end_at: values.subscription_end_at,
        subscription_start_at: values.subscription_start_at || undefined,
        auto_renew: values.auto_renew,
        max_offline_hours: values.max_offline_hours,
        requested_by: operator
      };

      const idempotencyKey = createIdempotencyKey();
      return provisionLicense(payload, idempotencyKey);
    },
    onSuccess: (result) => {
      setCreatedLicenseKey(result.license.license_key);
      setIsCreateOpen(false);
      appendOperationTrail({
        licenseKey: result.license.license_key,
        action: 'provision',
        requestedBy: operator,
        timestamp: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.summary(7) });
      form.reset({
        ...form.getValues(),
        email: '',
        name: '',
        document: ''
      });
    }
  });

  return (
    <>
      <SectionCard title={t('provision.title')} subtitle={t('provision.subtitle')}>
        <Stack spacing={1.5}>
          {!mutationsEnabled ? <Alert severity="warning">{t('mutations.disabled')}</Alert> : null}

          {createdLicenseKey ? (
            <Alert icon={<CheckCircleOutlineOutlinedIcon fontSize="inherit" />} severity="success">
              {t('provision.success', { licenseKey: createdLicenseKey })}
            </Alert>
          ) : null}

          <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
            {t('provision.tip')}
          </Typography>

          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineOutlinedIcon />}
              onClick={() => setIsCreateOpen(true)}
              disabled={!mutationsEnabled}
            >
              {t('provision.open')}
            </Button>
          </Stack>
        </Stack>
      </SectionCard>

      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{t('provision.title')}</DialogTitle>
        <DialogContent>
          <Stack
            component="form"
            spacing={1.2}
            sx={{ pt: 1 }}
            onSubmit={form.handleSubmit((values) => {
              if (!mutationsEnabled) {
                return;
              }
              mutation.mutate(values);
            })}
          >
            {mutation.error instanceof ApiError ? (
              <Alert severity="error">
                {mutation.error.problem.title}: {mutation.error.problem.detail || t('provision.errorDefault')}
              </Alert>
            ) : null}

            <Grid container spacing={1.2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField label={t('provision.form.programCode')} size="small" fullWidth {...form.register('program_code')} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField label={t('provision.form.planCode')} size="small" fullWidth {...form.register('plan_code')} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField label={t('provision.form.email')} size="small" fullWidth {...form.register('email')} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField label={t('provision.form.name')} size="small" fullWidth {...form.register('name')} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField label={t('provision.form.document')} size="small" fullWidth {...form.register('document')} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label={t('provision.form.endAt')}
                  size="small"
                  fullWidth
                  placeholder="2027-03-31T23:59:59.000Z"
                  {...form.register('subscription_end_at')}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label={t('provision.form.startAt')}
                  size="small"
                  fullWidth
                  placeholder="2026-03-01T00:00:00.000Z"
                  {...form.register('subscription_start_at')}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  control={form.control}
                  name="max_offline_hours"
                  render={({ field }) => (
                    <TextField
                      label={t('provision.form.maxOffline')}
                      size="small"
                      type="number"
                      fullWidth
                      value={field.value ?? ''}
                      onChange={(event) => {
                        const raw = event.target.value;
                        field.onChange(raw.length === 0 ? undefined : Number(raw));
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Controller
                  control={form.control}
                  name="auto_renew"
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                      label={t('provision.form.autoRenew')}
                    />
                  )}
                />
              </Grid>
            </Grid>

            <DialogActions sx={{ px: 0, pb: 0 }}>
              <Button type="button" variant="outlined" onClick={() => form.reset()} disabled={mutation.isPending}>
                {t('common.clear')}
              </Button>
              <Button type="submit" variant="contained" disabled={!mutationsEnabled || mutation.isPending}>
                {mutation.isPending ? t('provision.form.submitting') : t('provision.form.submit')}
              </Button>
            </DialogActions>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
