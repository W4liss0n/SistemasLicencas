import { Alert, Stack, Typography } from '@mui/material';
import type { AdminCustomerListItem } from '../../types/api';
import { useI18n } from '../../i18n';
import { ApiError } from '../../lib/http/api-error';
import { CustomerRecordAccordion } from './CustomerRecordAccordion';

type Props = {
  customers: AdminCustomerListItem[];
  isPending: boolean;
  error: unknown;
  mutationsEnabled: boolean;
  onOpenOnboarding: (customer?: AdminCustomerListItem) => void;
};

export function CustomerRecordsList({
  customers,
  isPending,
  error,
  mutationsEnabled,
  onOpenOnboarding
}: Props) {
  const { t } = useI18n();

  return (
    <Stack spacing={1.25}>
      {isPending ? <Alert severity="info">{t('customers.list.loading')}</Alert> : null}
      {error instanceof ApiError ? (
        <Alert severity="error">
          {error.problem.title}: {error.problem.detail || t('customers.list.errorDefault')}
        </Alert>
      ) : null}
      {!isPending && customers.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-muted)' }}>
          {t('customers.list.empty')}
        </Typography>
      ) : null}
      <Stack spacing={1.25}>
        {customers.map((customer) => (
          <CustomerRecordAccordion
            key={customer.id}
            customer={customer}
            onOpenOnboarding={mutationsEnabled ? onOpenOnboarding : undefined}
          />
        ))}
      </Stack>
    </Stack>
  );
}
