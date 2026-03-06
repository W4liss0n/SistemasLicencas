import { zodResolver } from '@hookform/resolvers/zod';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { queryClient } from '../../app/query-client';
import { isMutationsEnabled } from '../../app/runtime-config';
import { getOperatorName } from '../../app/session';
import { SectionCard } from '../../design/components/SectionCard';
import { useI18n } from '../../i18n';
import { ApiError } from '../../lib/http/api-error';
import { createIdempotencyKey } from '../../lib/idempotency/create-idempotency-key';
import type {
  AdminCustomerListItem,
  AdminCreateCustomerResponse,
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
import { CustomerRecordAccordion } from './CustomerRecordAccordion';
import { buildSubscriptionWindow } from './subscription-window';

const steps = ['customers.steps.customer', 'customers.steps.planPeriod', 'customers.steps.review'] as const;

const formSchema = z
  .object({
    customer_email: z.string().email('Email invalido'),
    customer_name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
    customer_document: z.string().optional(),
    plan_selection: z.string().min(1, 'Selecione um plano'),
    individual_program_id: z.string().optional(),
    plan_program_id: z.string().optional(),
    vigencia_mode: z.enum(['monthly', 'yearly', 'custom_end']),
    has_custom_start: z.boolean(),
    start_date: z.string().optional(),
    start_time: z.string().optional(),
    end_day: z.string().optional(),
    end_month: z.string().optional(),
    end_year: z.string().optional(),
    end_time: z.string().optional(),
    auto_renew: z.boolean(),
    max_offline_hours: z.number().int().min(1, 'Informe um numero valido').optional()
  })
  .superRefine((values, ctx) => {
    if (values.plan_selection === 'none') {
      return;
    }

    if (values.has_custom_start) {
      if (!values.start_date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe a data de inicio', path: ['start_date'] });
      }
      if (!values.start_time) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o horario de inicio', path: ['start_time'] });
      }
    }

    if (values.vigencia_mode === 'custom_end') {
      if (!values.end_day) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o dia final', path: ['end_day'] });
      }
      if (!values.end_month) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o mes final', path: ['end_month'] });
      }
      if (!values.end_year) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o ano final', path: ['end_year'] });
      }
      if (!values.end_time) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o horario final', path: ['end_time'] });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

type MutationResult =
  | { kind: 'customer'; response: AdminCreateCustomerResponse }
  | { kind: 'onboard'; response: AdminOnboardCustomerResponse };

const defaultValues: FormValues = {
  customer_email: '',
  customer_name: '',
  customer_document: '',
  plan_selection: 'none',
  individual_program_id: '',
  plan_program_id: '',
  vigencia_mode: 'monthly',
  has_custom_start: false,
  start_date: '',
  start_time: '00:00',
  end_day: '',
  end_month: '',
  end_year: '',
  end_time: '00:00',
  auto_renew: false,
  max_offline_hours: 72
};

export function CustomersPanel() {
  const operator = getOperatorName() || 'operator';
  const mutationsEnabled = isMutationsEnabled();
  const [activeStep, setActiveStep] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<MutationResult | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { t } = useI18n();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues
  });

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

  const planSelection = useWatch({ control: form.control, name: 'plan_selection' });
  const individualProgramId = useWatch({ control: form.control, name: 'individual_program_id' });
  const planProgramId = useWatch({ control: form.control, name: 'plan_program_id' });
  const hasCustomStart = useWatch({ control: form.control, name: 'has_custom_start' });
  const vigenciaMode = useWatch({ control: form.control, name: 'vigencia_mode' });

  const selectedRealPlan = useMemo(
    () => (plansQuery.data?.items ?? []).find((plan) => plan.id === planSelection),
    [planSelection, plansQuery.data?.items]
  );
  const selectedIndividualProgram = useMemo(
    () => (programsQuery.data?.items ?? []).find((program) => program.id === individualProgramId),
    [individualProgramId, programsQuery.data?.items]
  );
  const selectedPlanProgram = useMemo(() => {
    if (!selectedRealPlan) {
      return undefined;
    }
    if (selectedRealPlan.programs.length === 1) {
      return selectedRealPlan.programs[0];
    }
    return selectedRealPlan.programs.find((program) => program.id === planProgramId);
  }, [planProgramId, selectedRealPlan]);

  const isNoPlan = planSelection === 'none';
  const isIndividualProgram = planSelection === 'individual_program';
  const needsSubscription = !isNoPlan;
  const requiresPlanProgram = Boolean(selectedRealPlan && selectedRealPlan.programs.length > 1);

  useEffect(() => {
    if (planSelection !== 'individual_program' && form.getValues('individual_program_id')) {
      form.setValue('individual_program_id', '');
      form.clearErrors('individual_program_id');
    }
  }, [form, planSelection]);

  useEffect(() => {
    if (!selectedRealPlan || selectedRealPlan.programs.length <= 1) {
      if (form.getValues('plan_program_id')) {
        form.setValue('plan_program_id', '');
      }
      form.clearErrors('plan_program_id');
      return;
    }

    const currentProgramId = form.getValues('plan_program_id');
    const stillValid = selectedRealPlan.programs.some((program) => program.id === currentProgramId);
    if (!stillValid) {
      form.setValue('plan_program_id', '');
    }
  }, [form, selectedRealPlan]);

  useEffect(() => {
    if (needsSubscription && form.getValues('max_offline_hours') === undefined) {
      form.setValue('max_offline_hours', 72);
    }
  }, [form, needsSubscription]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues): Promise<MutationResult> => {
      const idempotencyKey = createIdempotencyKey();

      if (values.plan_selection === 'none') {
        const response = await createCustomer(
          {
            customer: {
              email: values.customer_email,
              name: values.customer_name,
              document: values.customer_document || undefined
            },
            requested_by: operator
          },
          idempotencyKey
        );
        return { kind: 'customer', response };
      }

      const window = buildSubscriptionWindow(
        {
          vigenciaMode: values.vigencia_mode,
          hasCustomStart: values.has_custom_start,
          startDate: values.start_date,
          startTime: values.start_time,
          endDay: values.end_day,
          endMonth: values.end_month,
          endYear: values.end_year,
          endTime: values.end_time
        },
        new Date()
      );

      const selectedPlan = (plansQuery.data?.items ?? []).find((plan) => plan.id === values.plan_selection);
      const shouldSendProgramId = selectedPlan ? selectedPlan.programs.length > 1 : false;

      const response = await onboardCustomer(
        {
          selection_mode: values.plan_selection === 'individual_program' ? 'individual_program' : 'plan',
          customer: {
            email: values.customer_email,
            name: values.customer_name,
            document: values.customer_document || undefined
          },
          plan_id: values.plan_selection !== 'individual_program' && values.plan_selection !== 'none' ? values.plan_selection : undefined,
          program_id: values.plan_selection === 'individual_program'
            ? values.individual_program_id || undefined
            : shouldSendProgramId
              ? values.plan_program_id || undefined
              : undefined,
          subscription_end_at: window.endAt,
          subscription_start_at: window.startAt,
          auto_renew: values.auto_renew,
          max_offline_hours: values.max_offline_hours,
          requested_by: operator
        },
        idempotencyKey
      );

      return { kind: 'onboard', response };
    },
    onSuccess: (response) => {
      setResult(response);
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['operational-summary'] });
      form.reset(defaultValues);
      setActiveStep(0);
    }
  });

  async function goNextStep(): Promise<void> {
    if (activeStep === 0) {
      const valid = await form.trigger(['customer_email', 'customer_name', 'customer_document']);
      if (valid) {
        setActiveStep(1);
      }
      return;
    }

    if (activeStep !== 1) {
      return;
    }

    const valid = await form.trigger([
      'plan_selection',
      'vigencia_mode',
      'has_custom_start',
      'start_date',
      'start_time',
      'end_day',
      'end_month',
      'end_year',
      'end_time',
      'auto_renew',
      'max_offline_hours'
    ]);

    if (!valid) {
      return;
    }

    if (isIndividualProgram && !individualProgramId) {
      form.setError('individual_program_id', { type: 'manual', message: t('customers.validation.selectProgram') });
      return;
    }

    if (requiresPlanProgram && !planProgramId) {
      form.setError('plan_program_id', { type: 'manual', message: t('customers.validation.selectProgram') });
      return;
    }

    if (needsSubscription) {
      try {
        buildSubscriptionWindow(
          {
            vigenciaMode,
            hasCustomStart,
            startDate: form.getValues('start_date'),
            startTime: form.getValues('start_time'),
            endDay: form.getValues('end_day'),
            endMonth: form.getValues('end_month'),
            endYear: form.getValues('end_year'),
            endTime: form.getValues('end_time')
          },
          new Date()
        );
      } catch (error) {
        form.setError('vigencia_mode', {
          type: 'manual',
          message: error instanceof Error ? error.message : t('customers.create.errorDefault')
        });
        return;
      }
    }

    setActiveStep(2);
  }

  function closeDialog(): void {
    setIsCreateOpen(false);
    setActiveStep(0);
    form.reset(defaultValues);
    mutation.reset();
  }

  function openOnboarding(customer?: AdminCustomerListItem): void {
    const nextValues: FormValues = customer
      ? {
          ...defaultValues,
          customer_email: customer.email,
          customer_name: customer.name,
          customer_document: customer.document ?? ''
        }
      : defaultValues;

    mutation.reset();
    form.reset(nextValues);
    setActiveStep(0);
    setIsCreateOpen(true);
  }

  function submit(): void {
    form.clearErrors(['individual_program_id', 'plan_program_id', 'vigencia_mode']);

    if (isIndividualProgram && !form.getValues('individual_program_id')) {
      form.setError('individual_program_id', { type: 'manual', message: t('customers.validation.selectProgram') });
      return;
    }

    if (requiresPlanProgram && !form.getValues('plan_program_id')) {
      form.setError('plan_program_id', { type: 'manual', message: t('customers.validation.selectProgram') });
      return;
    }

    form.handleSubmit((valuesToSend) => mutation.mutate(valuesToSend))();
  }

  const values = form.getValues();
  const reviewPlanLabel =
    values.plan_selection === 'none'
      ? t('customers.form.planNone')
      : values.plan_selection === 'individual_program'
        ? t('customers.form.planIndividual')
        : selectedRealPlan
          ? `${selectedRealPlan.name} (${selectedRealPlan.code})`
          : '-';

  const reviewProgramLabel =
    values.plan_selection === 'none'
      ? t('customers.form.planNone')
      : values.plan_selection === 'individual_program'
        ? selectedIndividualProgram
          ? `${selectedIndividualProgram.name} (${selectedIndividualProgram.code})`
          : '-'
        : selectedPlanProgram
          ? `${selectedPlanProgram.name} (${selectedPlanProgram.code})`
          : '-';

  const reviewWindow = (() => {
    if (!needsSubscription) {
      return t('customers.form.reviewNoSubscription');
    }

    try {
      const window = buildSubscriptionWindow(
        {
          vigenciaMode: values.vigencia_mode,
          hasCustomStart: values.has_custom_start,
          startDate: values.start_date,
          startTime: values.start_time,
          endDay: values.end_day,
          endMonth: values.end_month,
          endYear: values.end_year,
          endTime: values.end_time
        },
        new Date()
      );

      return window.startAt ? `${window.startAt} -> ${window.endAt}` : window.endAt;
    } catch {
      return t('customers.form.reviewInvalidWindow');
    }
  })();

  return (
    <>
      <SectionCard
        title={t('customers.list.title')}
        subtitle={t('customers.list.subtitle')}
        actions={
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <TextField
              label={t('customers.list.searchLabel')}
              size="small"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Button variant="outlined" startIcon={<SearchOutlinedIcon />} onClick={() => setSearch(searchInput)}>
              {t('common.search')}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineOutlinedIcon />}
              onClick={() => openOnboarding()}
              disabled={!mutationsEnabled}
            >
              {t('customers.create.open')}
            </Button>
          </Stack>
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
              {t('customers.create.successOnboard', { licenseKey: result.response.license.license_key })}
            </Alert>
          ) : null}
          {customersQuery.status === 'pending' ? <Alert severity="info">{t('customers.list.loading')}</Alert> : null}
          {customersQuery.error instanceof ApiError ? (
            <Alert severity="error">
              {customersQuery.error.problem.title}: {customersQuery.error.problem.detail || t('customers.list.errorDefault')}
            </Alert>
          ) : null}
          {customersQuery.data && customersQuery.data.items.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-muted)' }}>
              {t('customers.list.empty')}
            </Typography>
          ) : null}
          <Stack spacing={1.25}>
            {(customersQuery.data?.items ?? []).map((customer) => (
              <CustomerRecordAccordion
                key={customer.id}
                customer={customer}
                onOpenOnboarding={mutationsEnabled ? openOnboarding : undefined}
              />
            ))}
          </Stack>
        </Stack>
      </SectionCard>

      <Dialog open={isCreateOpen} onClose={closeDialog} fullWidth maxWidth="md">
        <DialogTitle>{t('customers.create.title')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
              {t('customers.create.subtitle')}
            </Typography>

            {mutation.error instanceof ApiError ? (
              <Alert severity="error">
                {mutation.error.problem.title}: {mutation.error.problem.detail || t('customers.create.errorDefault')}
              </Alert>
            ) : null}

            <Stepper activeStep={activeStep}>
              {steps.map((labelKey) => (
                <Step key={labelKey}>
                  <StepLabel>{t(labelKey)}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Stack spacing={1.2}>
              {activeStep === 0 ? (
                <>
                  <TextField
                    label={t('customers.form.email')}
                    size="small"
                    fullWidth
                    error={!!form.formState.errors.customer_email}
                    helperText={form.formState.errors.customer_email?.message}
                    {...form.register('customer_email')}
                  />
                  <TextField
                    label={t('customers.form.name')}
                    size="small"
                    fullWidth
                    error={!!form.formState.errors.customer_name}
                    helperText={form.formState.errors.customer_name?.message}
                    {...form.register('customer_name')}
                  />
                  <TextField label={t('customers.form.document')} size="small" fullWidth {...form.register('customer_document')} />
                </>
              ) : null}

              {activeStep === 1 ? (
                <>
                  <Controller
                    control={form.control}
                    name="plan_selection"
                    render={({ field }) => (
                      <FormControl size="small" fullWidth error={!!form.formState.errors.plan_selection}>
                        <InputLabel id="customers-plan-selection">{t('customers.form.plan')}</InputLabel>
                        <Select
                          labelId="customers-plan-selection"
                          label={t('customers.form.plan')}
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                        >
                          <MenuItem value="none">{t('customers.form.planNone')}</MenuItem>
                          <MenuItem value="individual_program">{t('customers.form.planIndividual')}</MenuItem>
                          {(plansQuery.data?.items ?? []).map((plan) => (
                            <MenuItem key={plan.id} value={plan.id}>
                              {plan.name} ({plan.code})
                            </MenuItem>
                          ))}
                        </Select>
                        {form.formState.errors.plan_selection ? <FormHelperText>{form.formState.errors.plan_selection.message}</FormHelperText> : null}
                      </FormControl>
                    )}
                  />
                  {isNoPlan ? <Alert severity="info">{t('customers.form.noPlanHint')}</Alert> : null}

                  {isIndividualProgram ? (
                    <Controller
                      control={form.control}
                      name="individual_program_id"
                      render={({ field }) => (
                        <FormControl size="small" fullWidth error={!!form.formState.errors.individual_program_id}>
                          <InputLabel id="customers-individual-program">{t('customers.form.individualProgram')}</InputLabel>
                          <Select
                            labelId="customers-individual-program"
                            label={t('customers.form.individualProgram')}
                            value={field.value}
                            onChange={(event) => field.onChange(event.target.value)}
                          >
                            <MenuItem value="">{t('customers.form.select')}</MenuItem>
                            {(programsQuery.data?.items ?? []).map((program) => (
                              <MenuItem key={program.id} value={program.id}>
                                {program.name} ({program.code})
                              </MenuItem>
                            ))}
                          </Select>
                          {form.formState.errors.individual_program_id ? (
                            <FormHelperText>{form.formState.errors.individual_program_id.message}</FormHelperText>
                          ) : null}
                        </FormControl>
                      )}
                    />
                  ) : null}

                  {selectedRealPlan && selectedRealPlan.programs.length === 1 ? (
                    <Alert severity="info">
                      {t('customers.form.linkedProgramFixed', {
                        program: `${selectedRealPlan.programs[0].name} (${selectedRealPlan.programs[0].code})`
                      })}
                    </Alert>
                  ) : null}

                  {requiresPlanProgram ? (
                    <Controller
                      control={form.control}
                      name="plan_program_id"
                      render={({ field }) => (
                        <FormControl size="small" fullWidth error={!!form.formState.errors.plan_program_id}>
                          <InputLabel id="customers-plan-program">{t('customers.form.program')}</InputLabel>
                          <Select
                            labelId="customers-plan-program"
                            label={t('customers.form.program')}
                            value={field.value}
                            onChange={(event) => field.onChange(event.target.value)}
                          >
                            <MenuItem value="">{t('customers.form.select')}</MenuItem>
                            {(selectedRealPlan?.programs ?? []).map((program) => (
                              <MenuItem key={program.id} value={program.id}>
                                {program.name} ({program.code})
                              </MenuItem>
                            ))}
                          </Select>
                          {form.formState.errors.plan_program_id ? (
                            <FormHelperText>{form.formState.errors.plan_program_id.message}</FormHelperText>
                          ) : null}
                        </FormControl>
                      )}
                    />
                  ) : null}

                  {needsSubscription ? (
                    <>
                      <FormControl error={!!form.formState.errors.vigencia_mode}>
                        <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                          {t('customers.form.subscriptionWindow')}
                        </Typography>
                        <Controller
                          control={form.control}
                          name="vigencia_mode"
                          render={({ field }) => (
                            <RadioGroup row value={field.value} onChange={(event) => field.onChange(event.target.value)}>
                              <FormControlLabel value="monthly" control={<Radio />} label={t('customers.form.monthly')} />
                              <FormControlLabel value="yearly" control={<Radio />} label={t('customers.form.yearly')} />
                              <FormControlLabel value="custom_end" control={<Radio />} label={t('customers.form.customEnd')} />
                            </RadioGroup>
                          )}
                        />
                        {form.formState.errors.vigencia_mode ? (
                          <FormHelperText>{form.formState.errors.vigencia_mode.message}</FormHelperText>
                        ) : null}
                      </FormControl>

                      <Controller
                        control={form.control}
                        name="has_custom_start"
                        render={({ field }) => (
                          <FormControlLabel
                            control={<Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                            label={t('customers.form.customStart')}
                          />
                        )}
                      />

                      {hasCustomStart ? (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <TextField
                            label={t('customers.form.startDate')}
                            size="small"
                            type="date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            error={!!form.formState.errors.start_date}
                            helperText={form.formState.errors.start_date?.message}
                            {...form.register('start_date')}
                          />
                          <TextField
                            label={t('customers.form.startTime')}
                            size="small"
                            type="time"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            error={!!form.formState.errors.start_time}
                            helperText={form.formState.errors.start_time?.message}
                            {...form.register('start_time')}
                          />
                        </Stack>
                      ) : null}

                      {vigenciaMode === 'custom_end' ? (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <TextField
                            label={t('customers.form.endDay')}
                            size="small"
                            fullWidth
                            error={!!form.formState.errors.end_day}
                            helperText={form.formState.errors.end_day?.message}
                            {...form.register('end_day')}
                          />
                          <TextField
                            label={t('customers.form.endMonth')}
                            size="small"
                            fullWidth
                            error={!!form.formState.errors.end_month}
                            helperText={form.formState.errors.end_month?.message}
                            {...form.register('end_month')}
                          />
                          <TextField
                            label={t('customers.form.endYear')}
                            size="small"
                            fullWidth
                            error={!!form.formState.errors.end_year}
                            helperText={form.formState.errors.end_year?.message}
                            {...form.register('end_year')}
                          />
                          <TextField
                            label={t('customers.form.endTime')}
                            size="small"
                            type="time"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            error={!!form.formState.errors.end_time}
                            helperText={form.formState.errors.end_time?.message}
                            {...form.register('end_time')}
                          />
                        </Stack>
                      ) : null}

                      <Controller
                        control={form.control}
                        name="max_offline_hours"
                        render={({ field }) => (
                          <TextField
                            label={t('customers.form.maxOffline')}
                            size="small"
                            type="number"
                            fullWidth
                            value={field.value ?? ''}
                            error={!!form.formState.errors.max_offline_hours}
                            helperText={form.formState.errors.max_offline_hours?.message}
                            onChange={(event) => {
                              const raw = event.target.value;
                              field.onChange(raw.length === 0 ? undefined : Number(raw));
                            }}
                          />
                        )}
                      />

                      <Controller
                        control={form.control}
                        name="auto_renew"
                        render={({ field }) => (
                          <FormControlLabel
                            control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                            label={t('customers.form.autoRenew')}
                          />
                        )}
                      />
                    </>
                  ) : null}
                </>
              ) : null}

              {activeStep === 2 ? (
                <SectionCard elevated>
                  <Stack spacing={0.7}>
                    <Typography variant="body2">
                      <strong>{t('customers.form.reviewCustomer')}:</strong> {values.customer_name} ({values.customer_email})
                    </Typography>
                    <Typography variant="body2">
                      <strong>{t('customers.form.reviewPlan')}:</strong> {reviewPlanLabel}
                    </Typography>
                    <Typography variant="body2">
                      <strong>{t('customers.form.reviewProgram')}:</strong> {reviewProgramLabel}
                    </Typography>
                    <Typography variant="body2">
                      <strong>{t('customers.form.reviewEnd')}:</strong> {reviewWindow}
                    </Typography>
                    {!needsSubscription ? <Typography variant="body2">{t('customers.form.reviewNoSubscription')}</Typography> : null}
                  </Stack>
                </SectionCard>
              ) : null}
            </Stack>

            <DialogActions sx={{ px: 0, pb: 0 }}>
              <Button
                variant="outlined"
                disabled={activeStep === 0}
                onClick={() => setActiveStep((current) => Math.max(0, current - 1))}
              >
                {t('common.back')}
              </Button>

              {activeStep < 2 ? (
                <Button variant="contained" onClick={() => void goNextStep()}>
                  {t('common.next')}
                </Button>
              ) : (
                <Button variant="contained" disabled={!mutationsEnabled || mutation.isPending} onClick={submit}>
                  {mutation.isPending
                    ? t('customers.form.processing')
                    : isNoPlan
                      ? t('customers.form.confirmCustomer')
                      : t('customers.form.confirmOnboard')}
                </Button>
              )}
            </DialogActions>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
