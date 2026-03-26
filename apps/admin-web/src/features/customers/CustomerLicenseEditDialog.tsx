import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { queryClient } from '../../app/query-client';
import { isMutationsEnabled } from '../../app/runtime-config';
import { getOperatorContextName } from '../../app/session';
import { useI18n } from '../../i18n';
import { ApiError } from '../../lib/http/api-error';
import { createIdempotencyKey } from '../../lib/idempotency/create-idempotency-key';
import type { AdminCustomerDetailsResponse } from '../../types/api';
import { queryKeys, updateLicense } from '../api';

type CustomerLicenseEntry = AdminCustomerDetailsResponse['licenses'][number];

type Props = {
  customerId: string;
  entry: CustomerLicenseEntry;
  open: boolean;
  onClose: () => void;
};

const formSchema = z.object({
  subscription_end_at: z.string().min(1, 'Informe o fim da assinatura'),
  auto_renew: z.boolean(),
  max_offline_hours: z.number().int().min(1, 'Informe um numero valido')
});

type FormValues = z.infer<typeof formSchema>;

function toDateTimeLocalInput(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function mapEntryToFormValues(entry: CustomerLicenseEntry): FormValues {
  return {
    subscription_end_at: toDateTimeLocalInput(entry.subscription.end_at),
    auto_renew: entry.subscription.auto_renew,
    max_offline_hours: entry.license.max_offline_hours
  };
}

export function CustomerLicenseEditDialog({ customerId, entry, open, onClose }: Props) {
  const operator = getOperatorContextName() || 'operator';
  const mutationsEnabled = isMutationsEnabled();
  const { t } = useI18n();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: mapEntryToFormValues(entry)
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) =>
      updateLicense(
        entry.license.license_key,
        {
          subscription_end_at: new Date(values.subscription_end_at).toISOString(),
          auto_renew: values.auto_renew,
          max_offline_hours: values.max_offline_hours,
          requested_by: operator
        },
        createIdempotencyKey()
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customerDetail(customerId) });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.license(entry.license.license_key) });
      onClose();
    }
  });

  function handleClose(): void {
    mutation.reset();
    form.reset(mapEntryToFormValues(entry));
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('customers.licenseEdit.title')}</DialogTitle>
      <DialogContent>
        <Stack
          component="form"
          spacing={1.25}
          sx={{ pt: 1 }}
          onSubmit={form.handleSubmit((values) => {
            if (!mutationsEnabled) {
              return;
            }
            mutation.mutate(values);
          })}
        >
          <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
            {t('customers.licenseEdit.subtitle')}
          </Typography>

          {mutation.error instanceof ApiError ? (
            <Alert severity="error">
              {mutation.error.problem.title}:{' '}
              {mutation.error.problem.detail || t('customers.licenseEdit.errorDefault')}
            </Alert>
          ) : null}

          <TextField
            label={t('customers.licenseEdit.endAt')}
            size="small"
            type="datetime-local"
            fullWidth
            InputLabelProps={{ shrink: true }}
            error={!!form.formState.errors.subscription_end_at}
            helperText={form.formState.errors.subscription_end_at?.message}
            {...form.register('subscription_end_at')}
          />

          <TextField
            label={t('customers.licenseEdit.maxOffline')}
            size="small"
            type="number"
            fullWidth
            error={!!form.formState.errors.max_offline_hours}
            helperText={form.formState.errors.max_offline_hours?.message}
            {...form.register('max_offline_hours', { valueAsNumber: true })}
          />

          <Controller
            control={form.control}
            name="auto_renew"
            render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                label={t('customers.licenseEdit.autoRenew')}
              />
            )}
          />

          <DialogActions sx={{ px: 0, pb: 0 }}>
            <Button type="button" variant="outlined" onClick={handleClose} disabled={mutation.isPending}>
              {t('common.close')}
            </Button>
            <Button type="submit" variant="contained" disabled={!mutationsEnabled || mutation.isPending}>
              {mutation.isPending ? t('customers.licenseEdit.submitting') : t('customers.licenseEdit.submit')}
            </Button>
          </DialogActions>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
