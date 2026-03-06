import { Inject, Injectable } from '@nestjs/common';
import { IdempotencyService } from '../../license-runtime/services/idempotency.service';
import {
  ADMIN_BACKOFFICE_PORT,
  AdminBackofficePort,
  AdminCustomerSummary,
  AdminLicenseDetails
} from '../ports/admin-backoffice.port';
import {
  AdminCreateCustomerResponseDto,
  AdminCustomerDetailsResponseDto,
  AdminCustomersListResponseDto,
  AdminLicenseResponseDto,
  AdminOnboardCustomerResponseDto,
  AdminOperationalSummaryResponseDto,
  AdminPlanDto,
  AdminPlanResponseDto,
  AdminPlansListResponseDto,
  AdminProgramDto,
  AdminProgramResponseDto,
  AdminProgramsListResponseDto,
  CreatePlanRequestDto,
  CreateCustomerRequestDto,
  CreateProgramRequestDto,
  LicenseActionRequestDto,
  OnboardCustomerRequestDto,
  ProvisionLicenseRequestDto,
  RenewLicenseRequestDto
} from '../dto/admin-backoffice.dto';

@Injectable()
export class AdminBackofficeService {
  private static readonly ENDPOINTS = {
    createProgram: '/api/v2/internal/admin/programs',
    createPlan: '/api/v2/internal/admin/plans',
    createCustomer: '/api/v2/internal/admin/customers',
    onboardCustomer: '/api/v2/internal/admin/customers/onboard',
    provision: '/api/v2/internal/admin/licenses',
    renew: (licenseKey: string) => `/api/v2/internal/admin/licenses/${licenseKey}/renew`,
    block: (licenseKey: string) => `/api/v2/internal/admin/licenses/${licenseKey}/block`,
    unblock: (licenseKey: string) => `/api/v2/internal/admin/licenses/${licenseKey}/unblock`,
    cancel: (licenseKey: string) => `/api/v2/internal/admin/licenses/${licenseKey}/cancel`
  };

  constructor(
    @Inject(ADMIN_BACKOFFICE_PORT) private readonly adminBackoffice: AdminBackofficePort,
    @Inject(IdempotencyService) private readonly idempotencyService: IdempotencyService
  ) {}

  async createProgram(
    payload: CreateProgramRequestDto,
    idempotencyKey: string
  ): Promise<AdminProgramResponseDto> {
    const execution = await this.idempotencyService.execute<AdminProgramResponseDto>({
      endpoint: AdminBackofficeService.ENDPOINTS.createProgram,
      idempotencyKey,
      payload,
      execute: async () => {
        const result = await this.adminBackoffice.createProgram({
          name: payload.name,
          description: payload.description,
          metadata: payload.metadata,
          requestedBy: payload.requested_by
        });

        return {
          statusCode: 200,
          body: {
            success: true,
            program: this.toProgramDto(result)
          }
        };
      }
    });

    return execution.body;
  }

  async listPrograms(input: {
    page: number;
    pageSize: number;
    query?: string;
  }): Promise<AdminProgramsListResponseDto> {
    const result = await this.adminBackoffice.listPrograms(input);
    return {
      success: true,
      items: result.items.map((item) => this.toProgramDto(item)),
      page: result.page,
      page_size: result.pageSize,
      total: result.total
    };
  }

  async createPlan(
    payload: CreatePlanRequestDto,
    idempotencyKey: string
  ): Promise<AdminPlanResponseDto> {
    const execution = await this.idempotencyService.execute<AdminPlanResponseDto>({
      endpoint: AdminBackofficeService.ENDPOINTS.createPlan,
      idempotencyKey,
      payload,
      execute: async () => {
        const result = await this.adminBackoffice.createPlan({
          name: payload.name,
          description: payload.description,
          maxDevices: payload.max_devices,
          maxOfflineHours: payload.max_offline_hours,
          features: payload.features,
          programIds: payload.program_ids,
          requestedBy: payload.requested_by
        });

        return {
          statusCode: 200,
          body: {
            success: true,
            plan: this.toPlanDto(result)
          }
        };
      }
    });

    return execution.body;
  }

  async listPlans(input: {
    page: number;
    pageSize: number;
    query?: string;
  }): Promise<AdminPlansListResponseDto> {
    const result = await this.adminBackoffice.listPlans(input);
    return {
      success: true,
      items: result.items.map((item) => this.toPlanDto(item)),
      page: result.page,
      page_size: result.pageSize,
      total: result.total
    };
  }

  async listCustomers(input: {
    page: number;
    pageSize: number;
    query?: string;
  }): Promise<AdminCustomersListResponseDto> {
    const result = await this.adminBackoffice.listCustomers(input);
    return {
      success: true,
      items: result.items.map((item) => this.toCustomerListItemDto(item)),
      page: result.page,
      page_size: result.pageSize,
      total: result.total
    };
  }

  async getCustomerDetails(customerId: string): Promise<AdminCustomerDetailsResponseDto> {
    const details = await this.adminBackoffice.getCustomerDetails({ customerId });

    return {
      success: true,
      customer: {
        id: details.customer.id,
        email: details.customer.email,
        name: details.customer.name,
        document: details.customer.document,
        created_at: details.customer.createdAt,
        updated_at: details.customer.updatedAt
      },
      licenses: details.licenses.map((entry) => ({
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
        programs: entry.programs.map((program) => this.toProgramDto(program)),
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

  async createCustomer(
    payload: CreateCustomerRequestDto,
    idempotencyKey: string
  ): Promise<AdminCreateCustomerResponseDto> {
    const execution = await this.idempotencyService.execute<AdminCreateCustomerResponseDto>({
      endpoint: AdminBackofficeService.ENDPOINTS.createCustomer,
      idempotencyKey,
      payload,
      execute: async () => {
        const result = await this.adminBackoffice.createCustomer({
          customer: {
            email: payload.customer.email,
            name: payload.customer.name,
            document: payload.customer.document
          },
          requestedBy: payload.requested_by
        });

        return {
          statusCode: 200,
          body: {
            success: true,
            customer: {
              id: result.customer.id,
              email: result.customer.email,
              name: result.customer.name,
              document: result.customer.document,
              created_at: result.customer.createdAt,
              updated_at: result.customer.updatedAt
            },
            end_user: {
              id: result.endUser.id,
              customer_id: result.endUser.customerId,
              identifier: result.endUser.identifier,
              status: result.endUser.status,
              created_at: result.endUser.createdAt,
              updated_at: result.endUser.updatedAt
            }
          }
        };
      }
    });

    return execution.body;
  }

  async onboardCustomer(
    payload: OnboardCustomerRequestDto,
    idempotencyKey: string
  ): Promise<AdminOnboardCustomerResponseDto> {
    const execution = await this.idempotencyService.execute<AdminOnboardCustomerResponseDto>({
      endpoint: AdminBackofficeService.ENDPOINTS.onboardCustomer,
      idempotencyKey,
      payload,
      execute: async () => {
        const result = await this.adminBackoffice.onboardCustomer({
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
        });

        return {
          statusCode: 200,
          body: {
            success: true,
            customer: {
              id: result.customer.id,
              email: result.customer.email,
              name: result.customer.name,
              document: result.customer.document,
              created_at: result.customer.createdAt,
              updated_at: result.customer.updatedAt
            },
            end_user: {
              id: result.endUser.id,
              customer_id: result.endUser.customerId,
              identifier: result.endUser.identifier,
              status: result.endUser.status,
              created_at: result.endUser.createdAt,
              updated_at: result.endUser.updatedAt
            },
            subscription: {
              id: result.subscription.id,
              status: result.subscription.status,
              start_at: result.subscription.startAt,
              end_at: result.subscription.endAt,
              auto_renew: result.subscription.autoRenew
            },
            plan: {
              id: result.plan.id,
              code: result.plan.code,
              name: result.plan.name,
              max_devices: result.plan.maxDevices,
              max_offline_hours: result.plan.maxOfflineHours,
              features: result.plan.features
            },
            program: {
              id: result.program.id,
              code: result.program.code,
              name: result.program.name,
              status: result.program.status
            },
            license: {
              id: result.license.id,
              license_key: result.license.licenseKey,
              status: result.license.status,
              max_offline_hours: result.license.maxOfflineHours,
              transfer_count: result.license.transferCount,
              created_at: result.license.createdAt,
              updated_at: result.license.updatedAt
            }
          }
        };
      }
    });

    return execution.body;
  }

  async provision(
    payload: ProvisionLicenseRequestDto,
    idempotencyKey: string
  ): Promise<AdminLicenseResponseDto> {
    const execution = await this.idempotencyService.execute<AdminLicenseResponseDto>({
      endpoint: AdminBackofficeService.ENDPOINTS.provision,
      idempotencyKey,
      payload,
      execute: async () => {
        const result = await this.adminBackoffice.provisionLicense({
          programCode: payload.program_code,
          planCode: payload.plan_code,
          customer: {
            email: payload.customer.email,
            name: payload.customer.name,
            document: payload.customer.document
          },
          subscription: {
            endAt: payload.subscription_end_at,
            startAt: payload.subscription_start_at,
            autoRenew: payload.auto_renew
          },
          maxOfflineHours: payload.max_offline_hours,
          metadata: payload.metadata,
          requestedBy: payload.requested_by
        });

        return {
          statusCode: 200,
          body: this.toLicenseResponse(result)
        };
      }
    });

    return execution.body;
  }

  async renew(
    licenseKey: string,
    payload: RenewLicenseRequestDto,
    idempotencyKey: string
  ): Promise<AdminLicenseResponseDto> {
    const execution = await this.idempotencyService.execute<AdminLicenseResponseDto>({
      endpoint: AdminBackofficeService.ENDPOINTS.renew(licenseKey),
      idempotencyKey,
      payload,
      execute: async () => {
        const result = await this.adminBackoffice.renewLicense({
          licenseKey,
          newEndAt: payload.new_end_at,
          requestedBy: payload.requested_by,
          reason: payload.reason
        });

        return {
          statusCode: 200,
          body: this.toLicenseResponse(result)
        };
      }
    });

    return execution.body;
  }

  async block(
    licenseKey: string,
    payload: LicenseActionRequestDto,
    idempotencyKey: string
  ): Promise<AdminLicenseResponseDto> {
    const execution = await this.idempotencyService.execute<AdminLicenseResponseDto>({
      endpoint: AdminBackofficeService.ENDPOINTS.block(licenseKey),
      idempotencyKey,
      payload,
      execute: async () => {
        const result = await this.adminBackoffice.blockLicense({
          licenseKey,
          requestedBy: payload.requested_by,
          reason: payload.reason
        });

        return {
          statusCode: 200,
          body: this.toLicenseResponse(result)
        };
      }
    });

    return execution.body;
  }

  async unblock(
    licenseKey: string,
    payload: LicenseActionRequestDto,
    idempotencyKey: string
  ): Promise<AdminLicenseResponseDto> {
    const execution = await this.idempotencyService.execute<AdminLicenseResponseDto>({
      endpoint: AdminBackofficeService.ENDPOINTS.unblock(licenseKey),
      idempotencyKey,
      payload,
      execute: async () => {
        const result = await this.adminBackoffice.unblockLicense({
          licenseKey,
          requestedBy: payload.requested_by,
          reason: payload.reason
        });

        return {
          statusCode: 200,
          body: this.toLicenseResponse(result)
        };
      }
    });

    return execution.body;
  }

  async cancel(
    licenseKey: string,
    payload: LicenseActionRequestDto,
    idempotencyKey: string
  ): Promise<AdminLicenseResponseDto> {
    const execution = await this.idempotencyService.execute<AdminLicenseResponseDto>({
      endpoint: AdminBackofficeService.ENDPOINTS.cancel(licenseKey),
      idempotencyKey,
      payload,
      execute: async () => {
        const result = await this.adminBackoffice.cancelLicense({
          licenseKey,
          requestedBy: payload.requested_by,
          reason: payload.reason
        });

        return {
          statusCode: 200,
          body: this.toLicenseResponse(result)
        };
      }
    });

    return execution.body;
  }

  async getLicenseDetails(licenseKey: string): Promise<AdminLicenseResponseDto> {
    const details = await this.adminBackoffice.getLicenseDetails({ licenseKey });
    return this.toLicenseResponse(details);
  }

  async getOperationalSummary(windowDays?: number): Promise<AdminOperationalSummaryResponseDto> {
    const summary = await this.adminBackoffice.getOperationalSummary({ windowDays });
    return {
      generated_at: summary.generatedAt,
      window_days: summary.windowDays,
      totals: {
        customers: summary.totals.customers,
        subscriptions_active: summary.totals.subscriptionsActive,
        licenses: summary.totals.licenses,
        licenses_active: summary.totals.licensesActive,
        devices_active: summary.totals.devicesActive
      },
      recent: {
        validation_failures: summary.recent.validationFailures,
        security_events_critical: summary.recent.securityEventsCritical,
        transfer_events: summary.recent.transferEvents,
        deactivate_events: summary.recent.deactivateEvents
      }
    };
  }

  private toLicenseResponse(input: AdminLicenseDetails): AdminLicenseResponseDto {
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

  private toProgramDto(input: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }): AdminProgramDto {
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

  private toPlanDto(input: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    maxDevices: number;
    maxOfflineHours: number;
    features: string[];
    createdAt: string;
    updatedAt: string;
    programs: Array<{
      id: string;
      code: string;
      name: string;
      description: string | null;
      status: string;
      metadata: Record<string, unknown>;
      createdAt: string;
      updatedAt: string;
    }>;
  }): AdminPlanDto {
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
      programs: input.programs.map((program) => this.toProgramDto(program))
    };
  }

  private toCustomerListItemDto(input: AdminCustomerSummary) {
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
}
