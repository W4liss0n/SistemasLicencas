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
import { getOperatorName } from '../../app/session';
import { SectionCard } from '../../design/components/SectionCard';
import { useI18n } from '../../i18n';
import { ApiError } from '../../lib/http/api-error';
import { createIdempotencyKey } from '../../lib/idempotency/create-idempotency-key';
import { createPlan, listPlans, listPrograms, queryKeys } from '../api';
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

export function PlansPanel() {
  const operator = getOperatorName() || 'operator';
  const mutationsEnabled = isMutationsEnabled();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { t } = useI18n();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      max_devices: 1,
      max_offline_hours: 72,
      features_raw: 'validate',
      program_ids: []
    }
  });

  const programsQuery = useQuery({
    queryKey: queryKeys.programs(1, 100, ''),
    queryFn: () => listPrograms({ page: 1, pageSize: 100, q: '' })
  });

  const plansQuery = useQuery({
    queryKey: queryKeys.plans(1, 20, search),
    queryFn: () => listPlans({ page: 1, pageSize: 20, q: search })
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const idempotencyKey = createIdempotencyKey();
      const features = (values.features_raw ?? '')
        .split(',')
        .map((feature) => feature.trim())
        .filter((feature) => feature.length > 0);

      return createPlan(
        {
          name: values.name,
          description: values.description || undefined,
          max_devices: values.max_devices,
          max_offline_hours: values.max_offline_hours,
          features,
          program_ids: values.program_ids,
          requested_by: operator
        },
        idempotencyKey
      );
    },
    onSuccess: (response) => {
      setCreatedCode(response.plan.code);
      setIsCreateOpen(false);
      form.reset({
        ...form.getValues(),
        name: '',
        description: '',
        features_raw: 'validate',
        program_ids: []
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans(1, 20, search) });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans(1, 100, '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers(1, 20, '') });
    }
  });

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
              onClick={() => setIsCreateOpen(true)}
              disabled={!mutationsEnabled}
            >
              {t('plans.create.open')}
            </Button>
          </Stack>
        }
      >
        <Stack spacing={1.25}>
          {!mutationsEnabled ? <Alert severity="warning">{t('mutations.disabled')}</Alert> : null}

          {createdCode ? (
            <Alert icon={<CheckCircleOutlineOutlinedIcon fontSize="inherit" />} severity="success">
              {t('plans.create.success', { code: createdCode })}
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
                <PlanSummaryCard plan={plan} />
              </Grid>
            ))}
          </Grid>
        </Stack>
      </SectionCard>

      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{t('plans.create.title')}</DialogTitle>
        <DialogContent>
          <Stack
            component="form"
            spacing={1.2}
            sx={{ pt: 1 }}
            onSubmit={form.handleSubmit((values) => {
              if (!mutationsEnabled) {
                return;
              }
              createMutation.mutate(values);
            })}
          >
            <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
              {t('plans.create.subtitle')}
            </Typography>

            {createMutation.error instanceof ApiError ? (
              <Alert severity="error">
                {createMutation.error.problem.title}: {createMutation.error.problem.detail || t('plans.create.errorDefault')}
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
              <Button type="button" variant="outlined" onClick={() => form.reset()} disabled={createMutation.isPending}>
                {t('common.clear')}
              </Button>
              <Button type="submit" variant="contained" disabled={!mutationsEnabled || createMutation.isPending}>
                {createMutation.isPending ? t('plans.create.submitting') : t('plans.create.submit')}
              </Button>
            </DialogActions>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
