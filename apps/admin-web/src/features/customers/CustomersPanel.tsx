import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { Alert, Stack } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { queryClient } from '../../app/query-client';
import { isMutationsEnabled } from '../../app/runtime-config';
import { getOperatorContextName } from '../../app/session';
import { SectionCard } from '../../design/components/SectionCard';
import { useI18n } from '../../i18n';
import { createIdempotencyKey } from '../../lib/idempotency/create-idempotency-key';
import type {
  AdminCreateCustomerResponse,
  AdminCustomerListItem,
  AdminOnboardCustomerResponse
} from '../../types/api';
import {
  createCustomer,
  listCustomers,
  listPlans,
  listPrograms,
  onboardCustomer,
  queryKeys
} from '../api';
import { CustomerOnboardingDialog } from './CustomerOnboardingDialog';
import { CustomerRecordsList } from './CustomerRecordsList';
import { CustomerSearchToolbar } from './CustomerSearchToolbar';
import {
  buildCustomerMutationRequest,
  type CustomerOnboardingFormValues
} from './customer-onboarding-form';
import { useCustomerOnboardingForm } from './useCustomerOnboardingForm';

type MutationResult =
  | { kind: 'customer'; response: AdminCreateCustomerResponse }
  | { kind: 'onboard'; response: AdminOnboardCustomerResponse };

export function CustomersPanel() {
  const operator = getOperatorContextName() || 'operator';
  const mutationsEnabled = isMutationsEnabled();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<MutationResult | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { t } = useI18n();

  const programsQuery = useQuery({
    queryKey: queryKeys.programs(1, 100, ''),
    queryFn: () => listPrograms({ page: 1, pageSize: 100, q: '' })
  });
  const plansQuery = useQuery({
    queryKey: queryKeys.plans(1, 100, ''),
    queryFn: () => listPlans({ page: 1, pageSize: 100, q: '' })
  });
  const customersQuery = useQuery({
    queryKey: queryKeys.customers(1, 20, search),
    queryFn: () => listCustomers({ page: 1, pageSize: 20, q: search })
  });

  const onboarding = useCustomerOnboardingForm({
    plans: plansQuery.data?.items ?? [],
    programs: programsQuery.data?.items ?? [],
    t
  });

  const mutation = useMutation({
    mutationFn: async (values: CustomerOnboardingFormValues): Promise<MutationResult> => {
      const request = buildCustomerMutationRequest(values, operator, plansQuery.data?.items ?? []);
      const idempotencyKey = createIdempotencyKey();

      if (request.kind === 'customer') {
        const response = await createCustomer(request.payload, idempotencyKey);
        return { kind: 'customer', response };
      }

      const response = await onboardCustomer(request.payload, idempotencyKey);
      return { kind: 'onboard', response };
    },
    onSuccess: (response) => {
      setResult(response);
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['operational-summary'] });
      onboarding.resetDialog();
    }
  });

  function openOnboarding(customer?: AdminCustomerListItem): void {
    mutation.reset();
    onboarding.prepareForOpen(customer);
    setIsCreateOpen(true);
  }

  function closeDialog(): void {
    setIsCreateOpen(false);
    mutation.reset();
    onboarding.resetDialog();
  }

  return (
    <>
      <SectionCard
        title={t('customers.list.title')}
        subtitle={t('customers.list.subtitle')}
        actions={
          <CustomerSearchToolbar
            searchInput={searchInput}
            mutationsEnabled={mutationsEnabled}
            onSearchInputChange={setSearchInput}
            onSearch={() => setSearch(searchInput)}
            onOpenOnboarding={() => openOnboarding()}
          />
        }
      >
        <Stack spacing={1.25}>
          {!mutationsEnabled ? <Alert severity="warning">{t('mutations.disabled')}</Alert> : null}
          {result?.kind === 'customer' ? (
            <Alert icon={<CheckCircleOutlineOutlinedIcon fontSize="inherit" />} severity="success">
              {t('customers.create.successCustomer')}
            </Alert>
          ) : null}
          {result?.kind === 'onboard' ? (
            <Alert icon={<CheckCircleOutlineOutlinedIcon fontSize="inherit" />} severity="success">
              {t('customers.create.successOnboard', {
                licenseKey: result.response.license.license_key
              })}
            </Alert>
          ) : null}

          <CustomerRecordsList
            customers={customersQuery.data?.items ?? []}
            isPending={customersQuery.status === 'pending'}
            error={customersQuery.error}
            mutationsEnabled={mutationsEnabled}
            onOpenOnboarding={openOnboarding}
          />
        </Stack>
      </SectionCard>

      <CustomerOnboardingDialog
        open={isCreateOpen}
        onboarding={onboarding}
        plans={plansQuery.data?.items ?? []}
        programs={programsQuery.data?.items ?? []}
        mutationsEnabled={mutationsEnabled}
        isMutationPending={mutation.isPending}
        error={mutation.error}
        onClose={closeDialog}
        onSubmit={(values) => mutation.mutate(values)}
      />
    </>
  );
}
