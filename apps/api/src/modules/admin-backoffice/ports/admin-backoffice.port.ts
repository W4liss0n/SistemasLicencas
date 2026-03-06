export interface GetOperationalSummaryInput {
  windowDays?: number;
}

export interface PaginationInput {
  page?: number;
  pageSize?: number;
  query?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreateProgramInput {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  requestedBy?: string;
}

export interface ListProgramsInput extends PaginationInput {}

export interface AdminProgramSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanInput {
  name: string;
  description?: string;
  maxDevices: number;
  maxOfflineHours: number;
  features: string[];
  programIds: string[];
  requestedBy?: string;
}

export interface ListPlansInput extends PaginationInput {}

export interface AdminPlanSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  maxDevices: number;
  maxOfflineHours: number;
  features: string[];
  createdAt: string;
  updatedAt: string;
  programs: AdminProgramSummary[];
}

export interface ListCustomersInput extends PaginationInput {}

export interface AdminCustomerSummary {
  id: string;
  email: string;
  name: string;
  document: string | null;
  createdAt: string;
  updatedAt: string;
  licensesCount: number;
  lastSubscriptionStatus: string | null;
}

export interface GetCustomerDetailsInput {
  customerId: string;
}

export interface CreateCustomerInput {
  customer: {
    email: string;
    name: string;
    document?: string;
  };
  requestedBy?: string;
}

export interface AdminCustomerDetails {
  customer: {
    id: string;
    email: string;
    name: string;
    document: string | null;
    createdAt: string;
    updatedAt: string;
  };
  licenses: Array<{
    license: {
      id: string;
      licenseKey: string;
      status: string;
      maxOfflineHours: number;
      transferCount: number;
      createdAt: string;
      updatedAt: string;
    };
    subscription: {
      id: string;
      status: string;
      startAt: string;
      endAt: string;
      autoRenew: boolean;
    };
    plan: {
      id: string;
      code: string;
      name: string;
      maxDevices: number;
      maxOfflineHours: number;
      features: string[];
    };
    programs: AdminProgramSummary[];
    devices: Array<{
      id: string;
      isActive: boolean;
      fingerprintHash: string;
      matchSource: string;
      lastSeenAt: string | null;
      createdAt: string;
    }>;
  }>;
}

export interface AdminCreateCustomerResult {
  customer: {
    id: string;
    email: string;
    name: string;
    document: string | null;
    createdAt: string;
    updatedAt: string;
  };
  endUser: {
    id: string;
    customerId: string;
    identifier: string;
    status: 'active' | 'blocked';
    createdAt: string;
    updatedAt: string;
  };
}

export interface OnboardCustomerInput {
  selectionMode: 'plan' | 'individual_program';
  customer: {
    email: string;
    name: string;
    document?: string;
  };
  programId?: string;
  planId?: string;
  subscriptionEndAt: string;
  subscriptionStartAt?: string;
  autoRenew?: boolean;
  maxOfflineHours?: number;
  requestedBy?: string;
}

export interface AdminOnboardCustomerResult {
  customer: {
    id: string;
    email: string;
    name: string;
    document: string | null;
    createdAt: string;
    updatedAt: string;
  };
  endUser: {
    id: string;
    customerId: string;
    identifier: string;
    status: 'active' | 'blocked';
    createdAt: string;
    updatedAt: string;
  };
  subscription: {
    id: string;
    status: string;
    startAt: string;
    endAt: string;
    autoRenew: boolean;
  };
  plan: {
    id: string;
    code: string;
    name: string;
    maxDevices: number;
    maxOfflineHours: number;
    features: string[];
  };
  program: {
    id: string;
    code: string;
    name: string;
    status: string;
  };
  license: {
    id: string;
    licenseKey: string;
    status: string;
    maxOfflineHours: number;
    transferCount: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface ProvisionLicenseInput {
  programCode: string;
  planCode: string;
  customer: {
    email: string;
    name: string;
    document?: string;
  };
  subscription: {
    endAt: string;
    startAt?: string;
    autoRenew?: boolean;
  };
  maxOfflineHours?: number;
  metadata?: Record<string, unknown>;
  requestedBy?: string;
}

export interface RenewLicenseInput {
  licenseKey: string;
  newEndAt: string;
  requestedBy?: string;
  reason?: string;
}

export interface LicenseActionInput {
  licenseKey: string;
  requestedBy?: string;
  reason?: string;
}

export interface GetLicenseDetailsInput {
  licenseKey: string;
}

export interface AdminLicenseDetails {
  license: {
    id: string;
    licenseKey: string;
    status: string;
    maxOfflineHours: number;
    transferCount: number;
    createdAt: string;
    updatedAt: string;
  };
  subscription: {
    id: string;
    status: string;
    startAt: string;
    endAt: string;
    autoRenew: boolean;
  };
  plan: {
    id: string;
    code: string;
    name: string;
    maxDevices: number;
    maxOfflineHours: number;
    features: string[];
  };
  customer: {
    id: string;
    email: string;
    name: string;
    document: string | null;
  };
  devices: Array<{
    id: string;
    isActive: boolean;
    fingerprintHash: string;
    matchSource: string;
    lastSeenAt: string | null;
    createdAt: string;
  }>;
}

export interface AdminOperationalSummary {
  generatedAt: string;
  windowDays: number;
  totals: {
    customers: number;
    subscriptionsActive: number;
    licenses: number;
    licensesActive: number;
    devicesActive: number;
  };
  recent: {
    validationFailures: number;
    securityEventsCritical: number;
    transferEvents: number;
    deactivateEvents: number;
  };
}

export const ADMIN_BACKOFFICE_PORT = Symbol('ADMIN_BACKOFFICE_PORT');

export interface AdminBackofficePort {
  createProgram(input: CreateProgramInput): Promise<AdminProgramSummary>;
  listPrograms(input: ListProgramsInput): Promise<PaginatedResult<AdminProgramSummary>>;
  createPlan(input: CreatePlanInput): Promise<AdminPlanSummary>;
  listPlans(input: ListPlansInput): Promise<PaginatedResult<AdminPlanSummary>>;
  listCustomers(input: ListCustomersInput): Promise<PaginatedResult<AdminCustomerSummary>>;
  getCustomerDetails(input: GetCustomerDetailsInput): Promise<AdminCustomerDetails>;
  createCustomer(input: CreateCustomerInput): Promise<AdminCreateCustomerResult>;
  onboardCustomer(input: OnboardCustomerInput): Promise<AdminOnboardCustomerResult>;
  provisionLicense(input: ProvisionLicenseInput): Promise<AdminLicenseDetails>;
  renewLicense(input: RenewLicenseInput): Promise<AdminLicenseDetails>;
  blockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails>;
  unblockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails>;
  cancelLicense(input: LicenseActionInput): Promise<AdminLicenseDetails>;
  getLicenseDetails(input: GetLicenseDetailsInput): Promise<AdminLicenseDetails>;
  getOperationalSummary(input?: GetOperationalSummaryInput): Promise<AdminOperationalSummary>;
}
