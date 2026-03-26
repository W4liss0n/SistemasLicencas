import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import type { AdminCustomerListItem, AdminPlan, AdminProgram } from '../../types/api';
import { buildSubscriptionWindow } from './subscription-window';
import {
  customerOnboardingFormSchema,
  defaultCustomerOnboardingValues,
  formatReviewPlanLabel,
  formatReviewProgramLabel,
  formatReviewWindowLabel,
  type CustomerOnboardingFormValues
} from './customer-onboarding-form';

type Options = {
  plans: AdminPlan[];
  programs: AdminProgram[];
  t: (key: string) => string;
};

export type CustomerOnboardingPrefill = Pick<
  AdminCustomerListItem,
  'email' | 'name' | 'document'
>;

export type UseCustomerOnboardingFormResult = {
  form: UseFormReturn<CustomerOnboardingFormValues>;
  activeStep: number;
  hasCustomStart: boolean;
  isIndividualProgram: boolean;
  isNoPlan: boolean;
  needsSubscription: boolean;
  requiresPlanProgram: boolean;
  vigenciaMode: CustomerOnboardingFormValues['vigencia_mode'];
  reviewPlanLabel: string;
  reviewProgramLabel: string;
  reviewWindowLabel: string;
  selectedRealPlan: AdminPlan | undefined;
  goNextStep: () => Promise<void>;
  goPreviousStep: () => void;
  prepareForOpen: (customer?: CustomerOnboardingPrefill) => void;
  resetDialog: () => void;
  submit: (onValid: (values: CustomerOnboardingFormValues) => void) => void;
};

export function useCustomerOnboardingForm({
  plans,
  programs,
  t
}: Options): UseCustomerOnboardingFormResult {
  const [activeStep, setActiveStep] = useState(0);

  const form = useForm<CustomerOnboardingFormValues>({
    resolver: zodResolver(customerOnboardingFormSchema),
    defaultValues: defaultCustomerOnboardingValues
  });

  const planSelection = useWatch({ control: form.control, name: 'plan_selection' });
  const individualProgramId = useWatch({ control: form.control, name: 'individual_program_id' });
  const planProgramId = useWatch({ control: form.control, name: 'plan_program_id' });
  const hasCustomStart = useWatch({ control: form.control, name: 'has_custom_start' });
  const vigenciaMode = useWatch({ control: form.control, name: 'vigencia_mode' });

  const selectedRealPlan = useMemo(
    () => plans.find((plan) => plan.id === planSelection),
    [planSelection, plans]
  );
  const selectedIndividualProgram = useMemo(
    () => programs.find((program) => program.id === individualProgramId),
    [individualProgramId, programs]
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
      form.setError('individual_program_id', {
        type: 'manual',
        message: t('customers.validation.selectProgram')
      });
      return;
    }

    if (requiresPlanProgram && !planProgramId) {
      form.setError('plan_program_id', {
        type: 'manual',
        message: t('customers.validation.selectProgram')
      });
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

  function goPreviousStep(): void {
    setActiveStep((current) => Math.max(0, current - 1));
  }

  function prepareForOpen(customer?: CustomerOnboardingPrefill): void {
    const nextValues: CustomerOnboardingFormValues = customer
      ? {
          ...defaultCustomerOnboardingValues,
          customer_email: customer.email,
          customer_name: customer.name,
          customer_document: customer.document ?? ''
        }
      : defaultCustomerOnboardingValues;

    form.reset(nextValues);
    setActiveStep(0);
  }

  function resetDialog(): void {
    setActiveStep(0);
    form.reset(defaultCustomerOnboardingValues);
  }

  function submit(onValid: (values: CustomerOnboardingFormValues) => void): void {
    form.clearErrors(['individual_program_id', 'plan_program_id', 'vigencia_mode']);

    if (isIndividualProgram && !form.getValues('individual_program_id')) {
      form.setError('individual_program_id', {
        type: 'manual',
        message: t('customers.validation.selectProgram')
      });
      return;
    }

    if (requiresPlanProgram && !form.getValues('plan_program_id')) {
      form.setError('plan_program_id', {
        type: 'manual',
        message: t('customers.validation.selectProgram')
      });
      return;
    }

    form.handleSubmit(onValid)();
  }

  const values = form.getValues();
  const reviewPlanLabel = formatReviewPlanLabel(values, selectedRealPlan, t);
  const reviewProgramLabel = formatReviewProgramLabel(
    values,
    selectedIndividualProgram,
    selectedPlanProgram,
    t
  );
  const reviewWindowLabel = formatReviewWindowLabel(values, needsSubscription, t);

  return {
    form,
    activeStep,
    hasCustomStart,
    isIndividualProgram,
    isNoPlan,
    needsSubscription,
    requiresPlanProgram,
    vigenciaMode,
    reviewPlanLabel,
    reviewProgramLabel,
    reviewWindowLabel,
    selectedRealPlan,
    goNextStep,
    goPreviousStep,
    prepareForOpen,
    resetDialog,
    submit
  };
}
