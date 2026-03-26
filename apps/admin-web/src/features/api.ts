import { requestJson } from '../lib/http/client';
import type {
  AdminCreateCustomerResponse,
  AdminCustomerDetailsResponse,
  AdminCustomersListResponse,
  AdminLicenseResponse,
  AdminOnboardCustomerResponse,
  AdminOperationalSummaryResponse,
  AdminPlanResponse,
  AdminPlansListResponse,
  AdminProgramResponse,
  AdminProgramsListResponse,
  CreatePlanPayload,
  CreateCustomerPayload,
  CreateProgramPayload,
  LicenseActionPayload,
  OnboardCustomerPayload,
  ProvisionLicensePayload,
  RenewLicensePayload,
  UpdateLicensePayload,
  UpdatePlanPayload
} from '../types/api';

export const queryKeys = {
  summary: (windowDays: number) => ['operational-summary', windowDays] as const,
  license: (licenseKey: string) => ['license-detail', licenseKey] as const,
  programs: (page: number, pageSize: number, q: string) =>
    ['programs', page, pageSize, q] as const,
  plans: (page: number, pageSize: number, q: string) => ['plans', page, pageSize, q] as const,
  customers: (page: number, pageSize: number, q: string) =>
    ['customers', page, pageSize, q] as const,
  customerDetail: (customerId: string) => ['customer-detail', customerId] as const
};

type ListInput = {
  page: number;
  pageSize: number;
  q?: string;
};

function listQueryString(input: ListInput): string {
  const params = new URLSearchParams();
  params.set('page', String(input.page));
  params.set('page_size', String(input.pageSize));
  if (input.q && input.q.trim().length > 0) {
    params.set('q', input.q.trim());
  }
  return params.toString();
}

export async function getOperationalSummary(windowDays: number): Promise<AdminOperationalSummaryResponse> {
  return requestJson<AdminOperationalSummaryResponse>(`/admin-api/operational-summary?window_days=${windowDays}`);
}

export async function getLicenseDetails(licenseKey: string): Promise<AdminLicenseResponse> {
  return requestJson<AdminLicenseResponse>(`/admin-api/licenses/${encodeURIComponent(licenseKey)}`);
}

export async function listPrograms(input: ListInput): Promise<AdminProgramsListResponse> {
  return requestJson<AdminProgramsListResponse>(`/admin-api/programs?${listQueryString(input)}`);
}

export async function createProgram(
  payload: CreateProgramPayload,
  idempotencyKey: string
): Promise<AdminProgramResponse> {
  return requestJson<AdminProgramResponse>('/admin-api/programs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });
}

export async function listPlans(input: ListInput): Promise<AdminPlansListResponse> {
  return requestJson<AdminPlansListResponse>(`/admin-api/plans?${listQueryString(input)}`);
}

export async function createPlan(payload: CreatePlanPayload, idempotencyKey: string): Promise<AdminPlanResponse> {
  return requestJson<AdminPlanResponse>('/admin-api/plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });
}

export async function updatePlan(
  planId: string,
  payload: UpdatePlanPayload,
  idempotencyKey: string
): Promise<AdminPlanResponse> {
  return requestJson<AdminPlanResponse>(`/admin-api/plans/${encodeURIComponent(planId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });
}

export async function listCustomers(input: ListInput): Promise<AdminCustomersListResponse> {
  return requestJson<AdminCustomersListResponse>(`/admin-api/customers?${listQueryString(input)}`);
}

export async function getCustomerDetails(customerId: string): Promise<AdminCustomerDetailsResponse> {
  return requestJson<AdminCustomerDetailsResponse>(`/admin-api/customers/${encodeURIComponent(customerId)}`);
}

export async function createCustomer(
  payload: CreateCustomerPayload,
  idempotencyKey: string
): Promise<AdminCreateCustomerResponse> {
  return requestJson<AdminCreateCustomerResponse>('/admin-api/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });
}

export async function onboardCustomer(
  payload: OnboardCustomerPayload,
  idempotencyKey: string
): Promise<AdminOnboardCustomerResponse> {
  return requestJson<AdminOnboardCustomerResponse>('/admin-api/customers/onboard', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });
}

export async function provisionLicense(payload: ProvisionLicensePayload, idempotencyKey: string): Promise<AdminLicenseResponse> {
  return requestJson<AdminLicenseResponse>('/admin-api/licenses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });
}

export async function renewLicense(
  licenseKey: string,
  payload: RenewLicensePayload,
  idempotencyKey: string
): Promise<AdminLicenseResponse> {
  return requestJson<AdminLicenseResponse>(`/admin-api/licenses/${encodeURIComponent(licenseKey)}/renew`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });
}

export async function updateLicense(
  licenseKey: string,
  payload: UpdateLicensePayload,
  idempotencyKey: string
): Promise<AdminLicenseResponse> {
  return requestJson<AdminLicenseResponse>(`/admin-api/licenses/${encodeURIComponent(licenseKey)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });
}

export async function blockLicense(
  licenseKey: string,
  payload: LicenseActionPayload,
  idempotencyKey: string
): Promise<AdminLicenseResponse> {
  return requestJson<AdminLicenseResponse>(`/admin-api/licenses/${encodeURIComponent(licenseKey)}/block`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });
}

export async function unblockLicense(
  licenseKey: string,
  payload: LicenseActionPayload,
  idempotencyKey: string
): Promise<AdminLicenseResponse> {
  return requestJson<AdminLicenseResponse>(`/admin-api/licenses/${encodeURIComponent(licenseKey)}/unblock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });
}

export async function cancelLicense(
  licenseKey: string,
  payload: LicenseActionPayload,
  idempotencyKey: string
): Promise<AdminLicenseResponse> {
  return requestJson<AdminLicenseResponse>(`/admin-api/licenses/${encodeURIComponent(licenseKey)}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });
}
