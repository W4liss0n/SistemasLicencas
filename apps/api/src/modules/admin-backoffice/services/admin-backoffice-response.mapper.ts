import type {
  AdminCreateCustomerResponseDto,
  AdminCustomerDetailsResponseDto,
  AdminCustomerListItemDto,
  AdminCustomersListResponseDto,
  AdminLicenseResponseDto,
  AdminOnboardCustomerResponseDto,
  AdminOperationalSummaryResponseDto,
  AdminPlanDto,
  AdminPlanResponseDto,
  AdminPlansListResponseDto,
  AdminProgramDto,
  AdminProgramResponseDto,
  AdminProgramsListResponseDto
} from '../dto/admin-backoffice.dto';
import type {
  AdminCreateCustomerResult,
  AdminCustomerDetails,
  AdminCustomerSummary,
  AdminLicenseDetails,
  AdminOnboardCustomerResult,
  AdminOperationalSummary,
  AdminPlanSummary,
  AdminProgramSummary,
  PaginatedResult
} from '../ports/admin-backoffice.port';

export function toProgramDto(input: AdminProgramSummary): AdminProgramDto {
  return {
    id: input.id,
    code: input.code,
    name: input.name,
    description: input.description,
    status: input.status,
    metadata: input.metadata,
    created_at: input.createdAt,
    updated_at: input.updatedAt
  };
}

export function toProgramResponseDto(input: AdminProgramSummary): AdminProgramResponseDto {
  return {
    success: true,
    program: toProgramDto(input)
  };
}

export function toProgramsListResponseDto(
  input: PaginatedResult<AdminProgramSummary>
): AdminProgramsListResponseDto {
  return {
    success: true,
    items: input.items.map((item) => toProgramDto(item)),
    page: input.page,
    page_size: input.pageSize,
    total: input.total
  };
}

export function toPlanDto(input: AdminPlanSummary): AdminPlanDto {
  return {
    id: input.id,
    code: input.code,
    name: input.name,
    description: input.description,
    max_devices: input.maxDevices,
    max_offline_hours: input.maxOfflineHours,
    features: input.features,
    created_at: input.createdAt,
    updated_at: input.updatedAt,
    programs: input.programs.map((program) => toProgramDto(program))
  };
}

export function toPlanResponseDto(input: AdminPlanSummary): AdminPlanResponseDto {
  return {
    success: true,
    plan: toPlanDto(input)
  };
}

export function toPlansListResponseDto(
  input: PaginatedResult<AdminPlanSummary>
): AdminPlansListResponseDto {
  return {
    success: true,
    items: input.items.map((item) => toPlanDto(item)),
    page: input.page,
    page_size: input.pageSize,
    total: input.total
  };
}

export function toCustomerListItemDto(input: AdminCustomerSummary): AdminCustomerListItemDto {
  return {
    id: input.id,
    email: input.email,
    name: input.name,
    document: input.document,
    created_at: input.createdAt,
    updated_at: input.updatedAt,
    licenses_count: input.licensesCount,
    last_subscription_status: input.lastSubscriptionStatus
  };
}

export function toCustomersListResponseDto(
  input: PaginatedResult<AdminCustomerSummary>
): AdminCustomersListResponseDto {
  return {
    success: true,
    items: input.items.map((item) => toCustomerListItemDto(item)),
    page: input.page,
    page_size: input.pageSize,
    total: input.total
  };
}

export function toCustomerDetailsResponseDto(
  input: AdminCustomerDetails
): AdminCustomerDetailsResponseDto {
  return {
    success: true,
    customer: {
      id: input.customer.id,
      email: input.customer.email,
      name: input.customer.name,
      document: input.customer.document,
      created_at: input.customer.createdAt,
      updated_at: input.customer.updatedAt
    },
    licenses: input.licenses.map((entry) => ({
      license: {
        id: entry.license.id,
        license_key: entry.license.licenseKey,
        status: entry.license.status,
        max_offline_hours: entry.license.maxOfflineHours,
        transfer_count: entry.license.transferCount,
        created_at: entry.license.createdAt,
        updated_at: entry.license.updatedAt
      },
      subscription: {
        id: entry.subscription.id,
        status: entry.subscription.status,
        start_at: entry.subscription.startAt,
        end_at: entry.subscription.endAt,
        auto_renew: entry.subscription.autoRenew
      },
      plan: {
        id: entry.plan.id,
        code: entry.plan.code,
        name: entry.plan.name,
        max_devices: entry.plan.maxDevices,
        max_offline_hours: entry.plan.maxOfflineHours,
        features: entry.plan.features
      },
      programs: entry.programs.map((program) => toProgramDto(program)),
      devices: entry.devices.map((device) => ({
        id: device.id,
        is_active: device.isActive,
        fingerprint_hash: device.fingerprintHash,
        match_source: device.matchSource,
        last_seen_at: device.lastSeenAt,
        created_at: device.createdAt
      }))
    }))
  };
}

export function toCreateCustomerResponseDto(
  input: AdminCreateCustomerResult
): AdminCreateCustomerResponseDto {
  return {
    success: true,
    customer: {
      id: input.customer.id,
      email: input.customer.email,
      name: input.customer.name,
      document: input.customer.document,
      created_at: input.customer.createdAt,
      updated_at: input.customer.updatedAt
    },
    end_user: {
      id: input.endUser.id,
      customer_id: input.endUser.customerId,
      identifier: input.endUser.identifier,
      status: input.endUser.status,
      created_at: input.endUser.createdAt,
      updated_at: input.endUser.updatedAt
    }
  };
}

export function toOnboardCustomerResponseDto(
  input: AdminOnboardCustomerResult
): AdminOnboardCustomerResponseDto {
  return {
    success: true,
    customer: {
      id: input.customer.id,
      email: input.customer.email,
      name: input.customer.name,
      document: input.customer.document,
      created_at: input.customer.createdAt,
      updated_at: input.customer.updatedAt
    },
    end_user: {
      id: input.endUser.id,
      customer_id: input.endUser.customerId,
      identifier: input.endUser.identifier,
      status: input.endUser.status,
      created_at: input.endUser.createdAt,
      updated_at: input.endUser.updatedAt
    },
    subscription: {
      id: input.subscription.id,
      status: input.subscription.status,
      start_at: input.subscription.startAt,
      end_at: input.subscription.endAt,
      auto_renew: input.subscription.autoRenew
    },
    plan: {
      id: input.plan.id,
      code: input.plan.code,
      name: input.plan.name,
      max_devices: input.plan.maxDevices,
      max_offline_hours: input.plan.maxOfflineHours,
      features: input.plan.features
    },
    program: {
      id: input.program.id,
      code: input.program.code,
      name: input.program.name,
      status: input.program.status
    },
    license: {
      id: input.license.id,
      license_key: input.license.licenseKey,
      status: input.license.status,
      max_offline_hours: input.license.maxOfflineHours,
      transfer_count: input.license.transferCount,
      created_at: input.license.createdAt,
      updated_at: input.license.updatedAt
    }
  };
}

export function toLicenseResponseDto(input: AdminLicenseDetails): AdminLicenseResponseDto {
  return {
    success: true,
    license: {
      id: input.license.id,
      license_key: input.license.licenseKey,
      status: input.license.status,
      max_offline_hours: input.license.maxOfflineHours,
      transfer_count: input.license.transferCount,
      created_at: input.license.createdAt,
      updated_at: input.license.updatedAt
    },
    subscription: {
      id: input.subscription.id,
      status: input.subscription.status,
      start_at: input.subscription.startAt,
      end_at: input.subscription.endAt,
      auto_renew: input.subscription.autoRenew
    },
    plan: {
      id: input.plan.id,
      code: input.plan.code,
      name: input.plan.name,
      max_devices: input.plan.maxDevices,
      max_offline_hours: input.plan.maxOfflineHours,
      features: input.plan.features
    },
    customer: {
      id: input.customer.id,
      email: input.customer.email,
      name: input.customer.name,
      document: input.customer.document
    },
    devices: input.devices.map((device) => ({
      id: device.id,
      is_active: device.isActive,
      fingerprint_hash: device.fingerprintHash,
      match_source: device.matchSource,
      last_seen_at: device.lastSeenAt,
      created_at: device.createdAt
    }))
  };
}

export function toOperationalSummaryResponseDto(
  input: AdminOperationalSummary
): AdminOperationalSummaryResponseDto {
  return {
    generated_at: input.generatedAt,
    window_days: input.windowDays,
    totals: {
      customers: input.totals.customers,
      subscriptions_active: input.totals.subscriptionsActive,
      licenses: input.totals.licenses,
      licenses_active: input.totals.licensesActive,
      devices_active: input.totals.devicesActive
    },
    recent: {
      validation_failures: input.recent.validationFailures,
      security_events_critical: input.recent.securityEventsCritical,
      transfer_events: input.recent.transferEvents,
      deactivate_events: input.recent.deactivateEvents
    }
  };
}
