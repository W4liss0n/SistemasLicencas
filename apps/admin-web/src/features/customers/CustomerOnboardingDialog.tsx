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
import { Controller } from 'react-hook-form';
import type { AdminPlan, AdminProgram } from '../../types/api';
import { SectionCard } from '../../design/components/SectionCard';
import { useI18n } from '../../i18n';
import { ApiError } from '../../lib/http/api-error';
import {
  customerOnboardingSteps,
  type CustomerOnboardingFormValues
} from './customer-onboarding-form';
import type { UseCustomerOnboardingFormResult } from './useCustomerOnboardingForm';

type Props = {
  open: boolean;
  onboarding: UseCustomerOnboardingFormResult;
  plans: AdminPlan[];
  programs: AdminProgram[];
  mutationsEnabled: boolean;
  isMutationPending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (values: CustomerOnboardingFormValues) => void;
};

export function CustomerOnboardingDialog({
  open,
  onboarding,
  plans,
  programs,
  mutationsEnabled,
  isMutationPending,
  error,
  onClose,
  onSubmit
}: Props) {
  const { t } = useI18n();
  const { form } = onboarding;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('customers.create.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
            {t('customers.create.subtitle')}
          </Typography>

          {error instanceof ApiError ? (
            <Alert severity="error">
              {error.problem.title}: {error.problem.detail || t('customers.create.errorDefault')}
            </Alert>
          ) : null}

          <Stepper activeStep={onboarding.activeStep}>
            {customerOnboardingSteps.map((labelKey) => (
              <Step key={labelKey}>
                <StepLabel>{t(labelKey)}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Stack spacing={1.2}>
            {onboarding.activeStep === 0 ? (
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
                <TextField
                  label={t('customers.form.document')}
                  size="small"
                  fullWidth
                  {...form.register('customer_document')}
                />
              </>
            ) : null}

            {onboarding.activeStep === 1 ? (
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
                        <MenuItem value="individual_program">
                          {t('customers.form.planIndividual')}
                        </MenuItem>
                        {plans.map((plan) => (
                          <MenuItem key={plan.id} value={plan.id}>
                            {plan.name} ({plan.code})
                          </MenuItem>
                        ))}
                      </Select>
                      {form.formState.errors.plan_selection ? (
                        <FormHelperText>
                          {form.formState.errors.plan_selection.message}
                        </FormHelperText>
                      ) : null}
                    </FormControl>
                  )}
                />
                {onboarding.isNoPlan ? <Alert severity="info">{t('customers.form.noPlanHint')}</Alert> : null}

                {onboarding.isIndividualProgram ? (
                  <Controller
                    control={form.control}
                    name="individual_program_id"
                    render={({ field }) => (
                      <FormControl
                        size="small"
                        fullWidth
                        error={!!form.formState.errors.individual_program_id}
                      >
                        <InputLabel id="customers-individual-program">
                          {t('customers.form.individualProgram')}
                        </InputLabel>
                        <Select
                          labelId="customers-individual-program"
                          label={t('customers.form.individualProgram')}
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                        >
                          <MenuItem value="">{t('customers.form.select')}</MenuItem>
                          {programs.map((program) => (
                            <MenuItem key={program.id} value={program.id}>
                              {program.name} ({program.code})
                            </MenuItem>
                          ))}
                        </Select>
                        {form.formState.errors.individual_program_id ? (
                          <FormHelperText>
                            {form.formState.errors.individual_program_id.message}
                          </FormHelperText>
                        ) : null}
                      </FormControl>
                    )}
                  />
                ) : null}

                {onboarding.selectedRealPlan && onboarding.selectedRealPlan.programs.length === 1 ? (
                  <Alert severity="info">
                    {t('customers.form.linkedProgramFixed', {
                      program: `${onboarding.selectedRealPlan.programs[0].name} (${onboarding.selectedRealPlan.programs[0].code})`
                    })}
                  </Alert>
                ) : null}

                {onboarding.requiresPlanProgram ? (
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
                          {(onboarding.selectedRealPlan?.programs ?? []).map((program) => (
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

                {onboarding.needsSubscription ? (
                  <>
                    <FormControl error={!!form.formState.errors.vigencia_mode}>
                      <Typography variant="body2" sx={{ color: 'var(--controlroom-ink-secondary)' }}>
                        {t('customers.form.subscriptionWindow')}
                      </Typography>
                      <Controller
                        control={form.control}
                        name="vigencia_mode"
                        render={({ field }) => (
                          <RadioGroup
                            row
                            value={field.value}
                            onChange={(event) => field.onChange(event.target.value)}
                          >
                            <FormControlLabel
                              value="monthly"
                              control={<Radio />}
                              label={t('customers.form.monthly')}
                            />
                            <FormControlLabel
                              value="yearly"
                              control={<Radio />}
                              label={t('customers.form.yearly')}
                            />
                            <FormControlLabel
                              value="custom_end"
                              control={<Radio />}
                              label={t('customers.form.customEnd')}
                            />
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
                          control={
                            <Checkbox
                              checked={field.value}
                              onChange={(event) => field.onChange(event.target.checked)}
                            />
                          }
                          label={t('customers.form.customStart')}
                        />
                      )}
                    />

                    {onboarding.hasCustomStart ? (
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

                    {onboarding.vigenciaMode === 'custom_end' ? (
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
                          control={
                            <Switch
                              checked={field.value}
                              onChange={(event) => field.onChange(event.target.checked)}
                            />
                          }
                          label={t('customers.form.autoRenew')}
                        />
                      )}
                    />
                  </>
                ) : null}
              </>
            ) : null}

            {onboarding.activeStep === 2 ? (
              <SectionCard elevated>
                <Stack spacing={0.7}>
                  <Typography variant="body2">
                    <strong>{t('customers.form.reviewCustomer')}:</strong>{' '}
                    {form.getValues('customer_name')} ({form.getValues('customer_email')})
                  </Typography>
                  <Typography variant="body2">
                    <strong>{t('customers.form.reviewPlan')}:</strong> {onboarding.reviewPlanLabel}
                  </Typography>
                  <Typography variant="body2">
                    <strong>{t('customers.form.reviewProgram')}:</strong>{' '}
                    {onboarding.reviewProgramLabel}
                  </Typography>
                  <Typography variant="body2">
                    <strong>{t('customers.form.reviewEnd')}:</strong> {onboarding.reviewWindowLabel}
                  </Typography>
                  {!onboarding.needsSubscription ? (
                    <Typography variant="body2">
                      {t('customers.form.reviewNoSubscription')}
                    </Typography>
                  ) : null}
                </Stack>
              </SectionCard>
            ) : null}
          </Stack>

          <DialogActions sx={{ px: 0, pb: 0 }}>
            <Button
              variant="outlined"
              disabled={onboarding.activeStep === 0}
              onClick={onboarding.goPreviousStep}
            >
              {t('common.back')}
            </Button>

            {onboarding.activeStep < 2 ? (
              <Button variant="contained" onClick={() => void onboarding.goNextStep()}>
                {t('common.next')}
              </Button>
            ) : (
              <Button
                variant="contained"
                disabled={!mutationsEnabled || isMutationPending}
                onClick={() => onboarding.submit(onSubmit)}
              >
                {isMutationPending
                  ? t('customers.form.processing')
                  : onboarding.isNoPlan
                    ? t('customers.form.confirmCustomer')
                    : t('customers.form.confirmOnboard')}
              </Button>
            )}
          </DialogActions>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
