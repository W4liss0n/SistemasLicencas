import type {
  CreateCustomerRequestDto,
  CreatePlanRequestDto,
  CreateProgramRequestDto,
  LicenseActionRequestDto,
  OnboardCustomerRequestDto,
  ProvisionLicenseRequestDto,
  RenewLicenseRequestDto,
  UpdateLicenseRequestDto,
  UpdatePlanRequestDto
} from '../dto/admin-backoffice.dto';
import type {
  CreateCustomerCommand,
  CreatePlanCommand,
  CreateProgramCommand,
  LicenseActionCommand,
  OnboardCustomerCommand,
  ProvisionLicenseCommand,
  RenewLicenseCommand,
  UpdateLicenseCommand,
  UpdatePlanCommand
} from '../services/application/admin-backoffice.commands';

export function toCreateProgramCommand(payload: CreateProgramRequestDto): CreateProgramCommand {
  return {
    name: payload.name,
    description: payload.description,
    metadata: payload.metadata,
    requestedBy: payload.requested_by
  };
}

export function toCreatePlanCommand(payload: CreatePlanRequestDto): CreatePlanCommand {
  return {
    name: payload.name,
    description: payload.description,
    maxDevices: payload.max_devices,
    maxOfflineHours: payload.max_offline_hours,
    features: payload.features,
    programIds: payload.program_ids,
    requestedBy: payload.requested_by
  };
}

export function toUpdatePlanCommand(
  planId: string,
  payload: UpdatePlanRequestDto
): UpdatePlanCommand {
  return {
    planId,
    name: payload.name,
    description: payload.description,
    maxDevices: payload.max_devices,
    maxOfflineHours: payload.max_offline_hours,
    features: payload.features,
    programIds: payload.program_ids,
    requestedBy: payload.requested_by
  };
}

export function toCreateCustomerCommand(payload: CreateCustomerRequestDto): CreateCustomerCommand {
  return {
    customer: {
      email: payload.customer.email,
      name: payload.customer.name,
      document: payload.customer.document
    },
    requestedBy: payload.requested_by
  };
}

export function toOnboardCustomerCommand(payload: OnboardCustomerRequestDto): OnboardCustomerCommand {
  return {
    selectionMode: payload.selection_mode,
    customer: {
      email: payload.customer.email,
      name: payload.customer.name,
      document: payload.customer.document
    },
    programId: payload.program_id,
    planId: payload.plan_id,
    subscriptionEndAt: payload.subscription_end_at,
    subscriptionStartAt: payload.subscription_start_at,
    autoRenew: payload.auto_renew,
    maxOfflineHours: payload.max_offline_hours,
    requestedBy: payload.requested_by
  };
}

export function toProvisionLicenseCommand(
  payload: ProvisionLicenseRequestDto
): ProvisionLicenseCommand {
  return {
    programCode: payload.program_code,
    planCode: payload.plan_code,
    customer: {
      email: payload.customer.email,
      name: payload.customer.name,
      document: payload.customer.document
    },
    subscriptionEndAt: payload.subscription_end_at,
    subscriptionStartAt: payload.subscription_start_at,
    autoRenew: payload.auto_renew,
    maxOfflineHours: payload.max_offline_hours,
    metadata: payload.metadata,
    requestedBy: payload.requested_by
  };
}

export function toRenewLicenseCommand(
  licenseKey: string,
  payload: RenewLicenseRequestDto
): RenewLicenseCommand {
  return {
    licenseKey,
    newEndAt: payload.new_end_at,
    requestedBy: payload.requested_by,
    reason: payload.reason
  };
}

export function toUpdateLicenseCommand(
  licenseKey: string,
  payload: UpdateLicenseRequestDto
): UpdateLicenseCommand {
  return {
    licenseKey,
    subscriptionEndAt: payload.subscription_end_at,
    autoRenew: payload.auto_renew,
    maxOfflineHours: payload.max_offline_hours,
    requestedBy: payload.requested_by
  };
}

export function toLicenseActionCommand(
  licenseKey: string,
  payload: LicenseActionRequestDto
): LicenseActionCommand {
  return {
    licenseKey,
    requestedBy: payload.requested_by,
    reason: payload.reason
  };
}
