import { z } from 'zod';
import type {
  AdminPlan,
  AdminProgram,
  CreateCustomerPayload,
  OnboardCustomerPayload
} from '../../types/api';
import { buildSubscriptionWindow } from './subscription-window';

export const customerOnboardingSteps = [
  'customers.steps.customer',
  'customers.steps.planPeriod',
  'customers.steps.review'
] as const;

export const customerOnboardingFormSchema = z
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
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe a data de inicio',
          path: ['start_date']
        });
      }
      if (!values.start_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o horario de inicio',
          path: ['start_time']
        });
      }
    }

    if (values.vigencia_mode === 'custom_end') {
      if (!values.end_day) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o dia final',
          path: ['end_day']
        });
      }
      if (!values.end_month) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o mes final',
          path: ['end_month']
        });
      }
      if (!values.end_year) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o ano final',
          path: ['end_year']
        });
      }
      if (!values.end_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o horario final',
          path: ['end_time']
        });
      }
    }
  });

export type CustomerOnboardingFormValues = z.infer<typeof customerOnboardingFormSchema>;

export type CustomerMutationRequest =
  | { kind: 'customer'; payload: CreateCustomerPayload }
  | { kind: 'onboard'; payload: OnboardCustomerPayload };

export const defaultCustomerOnboardingValues: CustomerOnboardingFormValues = {
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

export function buildCustomerMutationRequest(
  values: CustomerOnboardingFormValues,
  operator: string,
  plans: AdminPlan[]
): CustomerMutationRequest {
  if (values.plan_selection === 'none') {
    return {
      kind: 'customer',
      payload: {
        customer: {
          email: values.customer_email,
          name: values.customer_name,
          document: values.customer_document || undefined
        },
        requested_by: operator
      }
    };
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

  const selectedPlan = plans.find((plan) => plan.id === values.plan_selection);
  const shouldSendProgramId = selectedPlan ? selectedPlan.programs.length > 1 : false;

  return {
    kind: 'onboard',
    payload: {
      selection_mode: values.plan_selection === 'individual_program' ? 'individual_program' : 'plan',
      customer: {
        email: values.customer_email,
        name: values.customer_name,
        document: values.customer_document || undefined
      },
      plan_id:
        values.plan_selection !== 'individual_program' && values.plan_selection !== 'none'
          ? values.plan_selection
          : undefined,
      program_id:
        values.plan_selection === 'individual_program'
          ? values.individual_program_id || undefined
          : shouldSendProgramId
            ? values.plan_program_id || undefined
            : undefined,
      subscription_end_at: window.endAt,
      subscription_start_at: window.startAt,
      auto_renew: values.auto_renew,
      max_offline_hours: values.max_offline_hours,
      requested_by: operator
    }
  };
}

export function formatReviewPlanLabel(
  values: CustomerOnboardingFormValues,
  selectedRealPlan: AdminPlan | undefined,
  t: (key: string) => string
): string {
  if (values.plan_selection === 'none') {
    return t('customers.form.planNone');
  }

  if (values.plan_selection === 'individual_program') {
    return t('customers.form.planIndividual');
  }

  return selectedRealPlan ? `${selectedRealPlan.name} (${selectedRealPlan.code})` : '-';
}

export function formatReviewProgramLabel(
  values: CustomerOnboardingFormValues,
  selectedIndividualProgram: AdminProgram | undefined,
  selectedPlanProgram: AdminProgram | undefined,
  t: (key: string) => string
): string {
  if (values.plan_selection === 'none') {
    return t('customers.form.planNone');
  }

  if (values.plan_selection === 'individual_program') {
    return selectedIndividualProgram
      ? `${selectedIndividualProgram.name} (${selectedIndividualProgram.code})`
      : '-';
  }

  return selectedPlanProgram ? `${selectedPlanProgram.name} (${selectedPlanProgram.code})` : '-';
}

export function formatReviewWindowLabel(
  values: CustomerOnboardingFormValues,
  needsSubscription: boolean,
  t: (key: string) => string
): string {
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
}
