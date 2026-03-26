export interface AdminCommandCustomerPayload {
  email: string;
  name: string;
  document?: string;
}

export interface CreateProgramCommand {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  requestedBy?: string;
}

export interface CreatePlanCommand {
  name: string;
  description?: string;
  maxDevices: number;
  maxOfflineHours: number;
  features: string[];
  programIds: string[];
  requestedBy?: string;
}

export interface UpdatePlanCommand extends CreatePlanCommand {
  planId: string;
}

export interface CreateCustomerCommand {
  customer: AdminCommandCustomerPayload;
  requestedBy?: string;
}

export interface OnboardCustomerCommand {
  selectionMode: 'plan' | 'individual_program';
  customer: AdminCommandCustomerPayload;
  programId?: string;
  planId?: string;
  subscriptionEndAt: string;
  subscriptionStartAt?: string;
  autoRenew?: boolean;
  maxOfflineHours?: number;
  requestedBy?: string;
}

export interface ProvisionLicenseCommand {
  programCode: string;
  planCode: string;
  customer: AdminCommandCustomerPayload;
  subscriptionEndAt: string;
  subscriptionStartAt?: string;
  autoRenew?: boolean;
  maxOfflineHours?: number;
  metadata?: Record<string, unknown>;
  requestedBy?: string;
}

export interface RenewLicenseCommand {
  licenseKey: string;
  newEndAt: string;
  requestedBy?: string;
  reason?: string;
}

export interface UpdateLicenseCommand {
  licenseKey: string;
  subscriptionEndAt: string;
  autoRenew: boolean;
  maxOfflineHours: number;
  requestedBy?: string;
}

export interface LicenseActionCommand {
  licenseKey: string;
  requestedBy?: string;
  reason?: string;
}
