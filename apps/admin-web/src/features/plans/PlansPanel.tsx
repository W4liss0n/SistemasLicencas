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
  FormControlLabel,
  FormGroup,
  Grid,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { queryClient } from '../../app/query-client';
import { isMutationsEnabled } from '../../app/runtime-config';
import { getOperatorContextName } from '../../app/session';
import { SectionCard } from '../../design/components/SectionCard';
import { useI18n } from '../../i18n';
import { ApiError } from '../../lib/http/api-error';
import { createIdempotencyKey } from '../../lib/idempotency/create-idempotency-key';
import type { AdminPlan } from '../../types/api';
import { createPlan, listPlans, listPrograms, queryKeys, updatePlan } from '../api';
import { PlanSummaryCard } from './PlanSummaryCard';

const formSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  description: z.string().optional(),
  max_devices: z.number().int().min(1),
  max_offline_hours: z.number().int().min(1),
  features_raw: z.string().optional(),
  program_ids: z.array(z.string()).min(1, 'Selecione ao menos 1 programa')
});

type FormValues = z.infer<typeof formSchema>;
type DialogMode = 'create' | 'edit';

const defaultValues: FormValues = {
  name: '',
  description: '',
  max_devices: 1,
  max_offline_hours: 72,
  features_raw: 'validate',
  program_ids: []
};

function buildPayload(values: FormValues, operator: string) {
  const features = (values.features_raw ?? '')
    .split(',')
    .map((feature) => feature.trim())
    .filter((feature) => feature.length > 0);

  return {
    name: values.name,
    description: values.description || undefined,
    max_devices: values.max_devices,
    max_offline_hours: values.max_offline_hours,
    features,
    program_ids: values.program_ids,
    requested_by: operator
  };
}

function mapPlanToFormValues(plan: AdminPlan): FormValues {
  return {
    name: plan.name,
    description: plan.description ?? '',
    max_devices: plan.max_devices,
    max_offline_hours: plan.max_offline_hours,
    features_raw: plan.features.join(', '),
    program_ids: plan.programs.map((program) => program.id)
  };
}

export function PlansPanel() {
  const operator = getOperatorContextName() || 'operator';
  const mutationsEnabled = isMutationsEnabled();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<AdminPlan | null>(null);
  const [feedback, setFeedback] = useState<{ kind: DialogMode; code: string } | null>(null);
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
    queryKey: queryKeys.plans(1, 20, search),
    queryFn: () => listPlans({ page: 1, pageSize: 20, q: search })
  });

  const mutation = useMutation({
    mutationFn: async (input: { mode: DialogMode; values: FormValues; planId?: string }) => {
      const idempotencyKey = createIdempotencyKey();
      const payload = buildPayload(input.values, operator);

      if (input.mode === 'edit') {
        return updatePlan(input.planId ?? '', payload, idempotencyKey);
      }

      return createPlan(payload, idempotencyKey);
    },
    onSuccess: (response, variables) => {
      setFeedback({ kind: variables.mode, code: response.plan.code });
      closeDialog();
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail'] });
      queryClient.invalidateQueries({ queryKey: ['license-detail'] });
    }
  });

  function openCreateDialog(): void {
    setSelectedPlan(null);
    setDialogMode('create');
    mutation.reset();
    form.reset(defaultValues);
  }

  function openEditDialog(plan: AdminPlan): void {
    setSelectedPlan(plan);
    setDialogMode('edit');
    mutation.reset();
    form.reset(mapPlanToFormValues(plan));
  }

  function closeDialog(): void {
    setDialogMode(null);
    setSelectedPlan(null);
    mutation.reset();
    form.reset(defaultValues);
  }

  const isEditMode = dialogMode === 'edit';

  return (
    <>
      <SectionCard
        title={t('plans.list.title')}
        subtitle={t('plans.list.subtitle')}
        actions={
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <TextField
              label={t('plans.list.searchLabel')}
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
              onClick={openCreateDialog}
              disabled={!mutationsEnabled}
            >
              {t('plans.create.open')}
            </Button>
          </Stack>
        }
      >
        <Stack spacing={1.25}>
          {!mutationsEnabled ? <Alert severity="warning">{t('mutations.disabled')}</Alert> : null}

          {feedback ? (
            <Alert icon={<CheckCircleOutlineOutlinedIcon fontSize="inherit" />} severity="success">
              {feedback.kind === 'create'
                ? t('plans.create.success', { code: feedback.code })
                : t('plans.update.success', { code: feedback.code })}
            </Alert>
          ) : null}

          {plansQuery.status === 'pending' ? <Alert severity="info">{t('plans.list.loading')}</Alert> : null}

          {plansQuery.error instanceof ApiError ? (
            <Alert severity="error">
              {plansQuery.error.problem.title}: {plansQuery.error.problem.detail || t('plans.list.errorDefault')}
            </Alert>
          ) : null}

          {plansQuery.data && plansQuery.data.items.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-muted)' }}>
              {t('plans.list.empty')}
            </Typography>
          ) : null}

          <Grid container spacing={1.5}>
            {(plansQuery.data?.items ?? []).map((plan) => (
              <Grid key={plan.id} size={{ xs: 12, md: 6, xl: 4 }}>
                <PlanSummaryCard plan={plan} onEdit={openEditDialog} editDisabled={!mutationsEnabled} />
              </Grid>
            ))}
          </Grid>
        </Stack>
      </SectionCard>

      <Dialog open={dialogMode !== null} onClose={closeDialog} fullWidth maxWidth="md">
        <DialogTitle>{isEditMode ? t('plans.update.title') : t('plans.create.title')}</DialogTitle>
        <DialogContent>
          <Stack
            component="form"
            spacing={1.2}
            sx={{ pt: 1 }}
            onSubmit={form.handleSubmit((values) => {
              if (!dialogMode || !mutationsEnabled) {
                return;
              }

              mutation.mutate({
                mode: dialogMode,
                values,
                planId: selectedPlan?.id
              });
            })}
          >
            <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
              {isEditMode ? t('plans.update.subtitle') : t('plans.create.subtitle')}
            </Typography>

            {mutation.error instanceof ApiError ? (
              <Alert severity="error">
                {mutation.error.problem.title}:{' '}
                {mutation.error.problem.detail ||
                  (isEditMode ? t('plans.update.errorDefault') : t('plans.create.errorDefault'))}
              </Alert>
            ) : null}

            <TextField
              label={t('plans.create.name')}
              size="small"
              fullWidth
              error={!!form.formState.errors.name}
              helperText={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <TextField label={t('plans.create.description')} size="small" fullWidth {...form.register('description')} />
            <Grid container spacing={1.2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t('plans.create.maxDevices')}
                  size="small"
                  type="number"
                  fullWidth
                  error={!!form.formState.errors.max_devices}
                  helperText={form.formState.errors.max_devices?.message}
                  {...form.register('max_devices', { valueAsNumber: true })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t('plans.create.maxOfflineHours')}
                  size="small"
                  type="number"
                  fullWidth
                  error={!!form.formState.errors.max_offline_hours}
                  helperText={form.formState.errors.max_offline_hours?.message}
                  {...form.register('max_offline_hours', { valueAsNumber: true })}
                />
              </Grid>
            </Grid>
            <TextField label={t('plans.create.features')} size="small" fullWidth {...form.register('features_raw')} />

            <Stack spacing={0.8}>
              <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                {t('plans.create.linkedPrograms')}
              </Typography>
              <Controller
                control={form.control}
                name="program_ids"
                render={({ field }) => (
                  <FormGroup sx={{ maxHeight: 220, overflowY: 'auto', pr: 0.5 }}>
                    {(programsQuery.data?.items ?? []).map((program) => {
                      const checked = field.value.includes(program.id);
                      return (
                        <FormControlLabel
                          key={program.id}
                          control={
                            <Checkbox
                              checked={checked}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  field.onChange([...field.value, program.id]);
                                } else {
                                  field.onChange(field.value.filter((value) => value !== program.id));
                                }
                              }}
                            />
                          }
                          label={`${program.name} (${program.code})`}
                        />
                      );
                    })}
                  </FormGroup>
                )}
              />
              {form.formState.errors.program_ids ? (
                <Typography color="error" variant="caption">
                  {form.formState.errors.program_ids.message}
                </Typography>
              ) : null}
            </Stack>

            <DialogActions sx={{ px: 0, pb: 0 }}>
              <Button type="button" variant="outlined" onClick={closeDialog} disabled={mutation.isPending}>
                {t('common.close')}
              </Button>
              <Button type="submit" variant="contained" disabled={!mutationsEnabled || mutation.isPending}>
                {mutation.isPending
                  ? isEditMode
                    ? t('plans.update.submitting')
                    : t('plans.create.submitting')
                  : isEditMode
                    ? t('plans.update.submit')
                    : t('plans.create.submit')}
              </Button>
            </DialogActions>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
