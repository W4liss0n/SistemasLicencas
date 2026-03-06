export type ProblemDetails = {
  type?: string;
  title: string;
  status: number;
  code?: string;
  detail?: string;
  instance?: string;
  trace_id?: string;
};

export type AdminLicenseResponse = {
  success: true;
  license: {
    id: string;
    license_key: string;
    status: string;
    max_offline_hours: number;
    transfer_count: number;
    created_at: string;
    updated_at: string;
  };
  subscription: {
    id: string;
    status: string;
    start_at: string;
    end_at: string;
    auto_renew: boolean;
  };
  plan: {
    id: string;
    code: string;
    name: string;
    max_devices: number;
    max_offline_hours: number;
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
    is_active: boolean;
    fingerprint_hash: string;
    match_source: string;
    last_seen_at: string | null;
    created_at: string;
  }>;
};

export type AdminOperationalSummaryResponse = {
  generated_at: string;
  window_days: number;
  totals: {
    customers: number;
    subscriptions_active: number;
    licenses: number;
    licenses_active: number;
    devices_active: number;
  };
  recent: {
    validation_failures: number;
    security_events_critical: number;
    transfer_events: number;
    deactivate_events: number;
  };
};

export type ProvisionLicensePayload = {
  program_code: string;
  plan_code: string;
  customer: {
    email: string;
    name: string;
    document?: string;
  };
  subscription_end_at: string;
  subscription_start_at?: string;
  auto_renew?: boolean;
  max_offline_hours?: number;
  metadata?: Record<string, unknown>;
  requested_by?: string;
};

export type RenewLicensePayload = {
  new_end_at: string;
  requested_by?: string;
  reason?: string;
};

export type LicenseActionPayload = {
  requested_by?: string;
  reason?: string;
};

export type AdminProgram = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateProgramPayload = {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  requested_by?: string;
};

export type AdminProgramsListResponse = {
  success: true;
  items: AdminProgram[];
  page: number;
  page_size: number;
  total: number;
};

export type AdminProgramResponse = {
  success: true;
  program: AdminProgram;
};

export type AdminPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  max_devices: number;
  max_offline_hours: number;
  features: string[];
  created_at: string;
  updated_at: string;
  programs: AdminProgram[];
};

export type CreatePlanPayload = {
  name: string;
  description?: string;
  max_devices: number;
  max_offline_hours: number;
  features: string[];
  program_ids: string[];
  requested_by?: string;
};

export type AdminPlansListResponse = {
  success: true;
  items: AdminPlan[];
  page: number;
  page_size: number;
  total: number;
};

export type AdminPlanResponse = {
  success: true;
  plan: AdminPlan;
};

export type AdminCustomerListItem = {
  id: string;
  email: string;
  name: string;
  document: string | null;
  created_at: string;
  updated_at: string;
  licenses_count: number;
  last_subscription_status: string | null;
};

export type AdminCustomersListResponse = {
  success: true;
  items: AdminCustomerListItem[];
  page: number;
  page_size: number;
  total: number;
};

export type AdminCustomerDetailsResponse = {
  success: true;
  customer: {
    id: string;
    email: string;
    name: string;
    document: string | null;
    created_at: string;
    updated_at: string;
  };
  licenses: Array<{
    license: {
      id: string;
      license_key: string;
      status: string;
      max_offline_hours: number;
      transfer_count: number;
      created_at: string;
      updated_at: string;
    };
    subscription: {
      id: string;
      status: string;
      start_at: string;
      end_at: string;
      auto_renew: boolean;
    };
    plan: {
      id: string;
      code: string;
      name: string;
      max_devices: number;
      max_offline_hours: number;
      features: string[];
    };
    programs: AdminProgram[];
    devices: Array<{
      id: string;
      is_active: boolean;
      fingerprint_hash: string;
      match_source: string;
      last_seen_at: string | null;
      created_at: string;
    }>;
  }>;
};

export type CreateCustomerPayload = {
  customer: {
    email: string;
    name: string;
    document?: string;
  };
  requested_by?: string;
};

export type AdminCreateCustomerResponse = {
  success: true;
  customer: {
    id: string;
    email: string;
    name: string;
    document: string | null;
    created_at: string;
    updated_at: string;
  };
  end_user: {
    id: string;
    customer_id: string;
    identifier: string;
    status: 'active' | 'blocked';
    created_at: string;
    updated_at: string;
  };
};

export type OnboardCustomerPayload = {
  selection_mode: 'plan' | 'individual_program';
  customer: {
    email: string;
    name: string;
    document?: string;
  };
  program_id?: string;
  plan_id?: string;
  subscription_end_at: string;
  subscription_start_at?: string;
  auto_renew?: boolean;
  max_offline_hours?: number;
  requested_by?: string;
};

export type AdminOnboardCustomerResponse = {
  success: true;
  customer: {
    id: string;
    email: string;
    name: string;
    document: string | null;
    created_at: string;
    updated_at: string;
  };
  end_user: {
    id: string;
    customer_id: string;
    identifier: string;
    status: 'active' | 'blocked';
    created_at: string;
    updated_at: string;
  };
  subscription: {
    id: string;
    status: string;
    start_at: string;
    end_at: string;
    auto_renew: boolean;
  };
  plan: {
    id: string;
    code: string;
    name: string;
    max_devices: number;
    max_offline_hours: number;
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
    license_key: string;
    status: string;
    max_offline_hours: number;
    transfer_count: number;
    created_at: string;
    updated_at: string;
  };
};

export type OperationAction = 'provision' | 'renew' | 'block' | 'unblock' | 'cancel';

export type OperationTrailEntry = {
  licenseKey: string;
  action: OperationAction;
  requestedBy: string;
  reason?: string;
  timestamp: string;
};
