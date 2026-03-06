import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  AdminBackofficePort,
  AdminCreateCustomerResult,
  AdminCustomerDetails,
  AdminCustomerSummary,
  AdminLicenseDetails,
  AdminOnboardCustomerResult,
  AdminOperationalSummary,
  AdminPlanSummary,
  AdminProgramSummary,
  CreatePlanInput,
  CreateCustomerInput,
  CreateProgramInput,
  GetCustomerDetailsInput,
  GetLicenseDetailsInput,
  ListCustomersInput,
  ListPlansInput,
  ListProgramsInput,
  GetOperationalSummaryInput,
  LicenseActionInput,
  OnboardCustomerInput,
  PaginatedResult,
  ProvisionLicenseInput,
  RenewLicenseInput
} from '../ports/admin-backoffice.port';

@Injectable()
export class PrismaAdminBackofficeService implements AdminBackofficePort {
  private static readonly LICENSE_KEY_ATTEMPTS = 8;
  private static readonly CODE_GENERATION_ATTEMPTS = 8;
  private static readonly DEFAULT_PAGE_SIZE = 20;
  private static readonly MAX_PAGE_SIZE = 100;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createProgram(input: CreateProgramInput): Promise<AdminProgramSummary> {
    const name = this.normalizeRequiredText(input.name, 'name');
    const description = this.normalizeOptionalText(input.description);
    const metadata = this.normalizeMetadata(input.metadata);
    const requestedBy = this.normalizeOptionalText(input.requestedBy) ?? 'internal-admin';

    const created = await this.createProgramWithRetry({
      name,
      description,
      metadata
    });

    await this.writeAuditLog({
      entityType: 'program',
      entityId: created.id,
      action: 'admin_program_create',
      payload: {
        requested_by: requestedBy,
        program_id: created.id,
        program_code: created.code
      }
    });

    return this.toProgramSummary(created);
  }

  async listPrograms(input: ListProgramsInput): Promise<PaginatedResult<AdminProgramSummary>> {
    const pagination = this.resolvePagination(input);
    const where: Prisma.ProgramWhereInput | undefined = pagination.query
      ? {
          OR: [
            { code: { contains: pagination.query, mode: 'insensitive' } },
            { name: { contains: pagination.query, mode: 'insensitive' } },
            { description: { contains: pagination.query, mode: 'insensitive' } }
          ]
        }
      : undefined;

    const [total, items] = await Promise.all([
      this.prisma.program.count({ where }),
      this.prisma.program.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.pageSize
      })
    ]);

    return {
      items: items.map((item) => this.toProgramSummary(item)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total
    };
  }

  async createPlan(input: CreatePlanInput): Promise<AdminPlanSummary> {
    const name = this.normalizeRequiredText(input.name, 'name');
    const description = this.normalizeOptionalText(input.description);
    const requestedBy = this.normalizeOptionalText(input.requestedBy) ?? 'internal-admin';
    const maxDevices = this.normalizePositiveInteger(input.maxDevices, 'max_devices');
    const maxOfflineHours = this.normalizePositiveInteger(
      input.maxOfflineHours,
      'max_offline_hours'
    );
    const features = this.normalizeFeatures(input.features);
    const programIds = Array.from(
      new Set(
        input.programIds
          .map((programId) => this.normalizeRequiredText(programId, 'program_ids'))
          .filter((programId) => programId.length > 0)
      )
    );

    if (programIds.length === 0) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'program_ids must include at least one program'
      );
    }

    const programs = await this.prisma.program.findMany({
      where: {
        id: {
          in: programIds
        }
      },
      select: { id: true }
    });

    if (programs.length !== programIds.length) {
      this.throwDomainError(HttpStatus.NOT_FOUND, 'program_not_found', 'One or more programs were not found');
    }

    const created = await this.createPlanWithRetry({
      name,
      description,
      maxDevices,
      maxOfflineHours,
      features,
      programIds
    });

    await this.writeAuditLog({
      entityType: 'plan',
      entityId: created.id,
      action: 'admin_plan_create',
      payload: {
        requested_by: requestedBy,
        plan_id: created.id,
        plan_code: created.code,
        program_ids: programIds
      }
    });

    return this.toPlanSummary(created);
  }

  async listPlans(input: ListPlansInput): Promise<PaginatedResult<AdminPlanSummary>> {
    const pagination = this.resolvePagination(input);
    const where: Prisma.PlanWhereInput = {
      isInternal: false,
      ...(pagination.query
        ? {
            OR: [
              { code: { contains: pagination.query, mode: 'insensitive' } },
              { name: { contains: pagination.query, mode: 'insensitive' } },
              { description: { contains: pagination.query, mode: 'insensitive' } }
            ]
          }
        : {})
    };

    const [total, items] = await Promise.all([
      this.prisma.plan.count({ where }),
      this.prisma.plan.findMany({
        where,
        include: {
          planPrograms: {
            include: { program: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.pageSize
      })
    ]);

    return {
      items: items.map((item) => this.toPlanSummary(item)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total
    };
  }

  async listCustomers(input: ListCustomersInput): Promise<PaginatedResult<AdminCustomerSummary>> {
    const pagination = this.resolvePagination(input);
    const where: Prisma.CustomerWhereInput | undefined = pagination.query
      ? {
          OR: [
            { email: { contains: pagination.query, mode: 'insensitive' } },
            { name: { contains: pagination.query, mode: 'insensitive' } },
            { document: { contains: pagination.query, mode: 'insensitive' } }
          ]
        }
      : undefined;

    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include: {
          subscriptions: {
            select: {
              status: true,
              createdAt: true,
              _count: {
                select: { licenses: true }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.pageSize
      })
    ]);

    return {
      items: customers.map((customer) => this.toCustomerSummary(customer)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total
    };
  }

  async getCustomerDetails(input: GetCustomerDetailsInput): Promise<AdminCustomerDetails> {
    const customerId = this.normalizeRequiredText(input.customerId, 'customer_id');
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        subscriptions: {
          include: {
            plan: {
              include: {
                planPrograms: {
                  include: { program: true }
                }
              }
            },
            licenses: {
              include: {
                devices: {
                  include: {
                    fingerprint: true
                  },
                  orderBy: {
                    createdAt: 'desc'
                  }
                }
              },
              orderBy: {
                createdAt: 'desc'
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!customer) {
      this.throwDomainError(HttpStatus.NOT_FOUND, 'customer_not_found', 'Customer not found');
    }

    return {
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        document: customer.document,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString()
      },
      licenses: customer.subscriptions.flatMap((subscription) => {
        const programs = subscription.plan.planPrograms
          .map((planProgram) => this.toProgramSummary(planProgram.program))
          .sort((left, right) => left.name.localeCompare(right.name));
        const features = this.toStringArray(subscription.plan.features);

        return subscription.licenses.map((license) => ({
          license: {
            id: license.id,
            licenseKey: license.licenseKey,
            status: license.status,
            maxOfflineHours: license.maxOfflineHours,
            transferCount: license.transferCount,
            createdAt: license.createdAt.toISOString(),
            updatedAt: license.updatedAt.toISOString()
          },
          subscription: {
            id: subscription.id,
            status: subscription.status,
            startAt: subscription.startAt.toISOString(),
            endAt: subscription.endAt.toISOString(),
            autoRenew: subscription.autoRenew
          },
          plan: {
            id: subscription.plan.id,
            code: subscription.plan.code,
            name: subscription.plan.name,
            maxDevices: subscription.plan.maxDevices,
            maxOfflineHours: subscription.plan.maxOfflineHours,
            features
          },
          programs,
          devices: license.devices.map((device) => ({
            id: device.id,
            isActive: device.isActive,
            fingerprintHash: device.fingerprint.fingerprintHash,
            matchSource: device.matchSource,
            lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
            createdAt: device.createdAt.toISOString()
          }))
        }));
      })
    };
  }

  async createCustomer(input: CreateCustomerInput): Promise<AdminCreateCustomerResult> {
    const customerEmail = this.normalizeEmail(input.customer.email);
    const customerName = this.normalizeRequiredText(input.customer.name, 'customer.name');
    const customerDocument = this.normalizeOptionalText(input.customer.document);
    const requestedBy = this.normalizeOptionalText(input.requestedBy) ?? 'internal-admin';

    const result = await this.prisma.$transaction(async (tx) => {
      const { customer, endUser } = await this.upsertCustomerAndEndUser(tx, {
        email: customerEmail,
        name: customerName,
        document: customerDocument
      });

      await tx.auditLog.create({
        data: {
          entityType: 'customer',
          entityId: customer.id,
          action: 'admin_customer_create',
          payload: {
            requested_by: requestedBy,
            customer_id: customer.id,
            end_user_id: endUser.id
          } as Prisma.InputJsonValue
        }
      });

      return {
        customer,
        endUser
      };
    });

    return {
      customer: {
        id: result.customer.id,
        email: result.customer.email,
        name: result.customer.name,
        document: result.customer.document,
        createdAt: result.customer.createdAt.toISOString(),
        updatedAt: result.customer.updatedAt.toISOString()
      },
      endUser: {
        id: result.endUser.id,
        customerId: result.endUser.customerId,
        identifier: result.endUser.identifier,
        status: result.endUser.status,
        createdAt: result.endUser.createdAt.toISOString(),
        updatedAt: result.endUser.updatedAt.toISOString()
      }
    };
  }

  async onboardCustomer(input: OnboardCustomerInput): Promise<AdminOnboardCustomerResult> {
    const customerEmail = this.normalizeEmail(input.customer.email);
    const customerName = this.normalizeRequiredText(input.customer.name, 'customer.name');
    const customerDocument = this.normalizeOptionalText(input.customer.document);
    const selectionMode = this.normalizeSelectionMode(input.selectionMode);
    const subscriptionStartAt = input.subscriptionStartAt
      ? this.parseDate(input.subscriptionStartAt, 'subscription_start_at')
      : new Date();
    const subscriptionEndAt = this.parseDate(input.subscriptionEndAt, 'subscription_end_at');
    const requestedBy = this.normalizeOptionalText(input.requestedBy) ?? 'internal-admin';

    if (subscriptionEndAt <= subscriptionStartAt) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'subscription_end_at must be greater than subscription_start_at'
      );
    }

    if (input.maxOfflineHours !== undefined) {
      this.normalizePositiveInteger(input.maxOfflineHours, 'max_offline_hours');
    }

    const result = await this.prisma
      .$transaction(async (tx) => {
        const { plan, program } = await this.resolveOnboardingSelection(tx, input, selectionMode);
        const { customer, endUser } = await this.upsertCustomerAndEndUser(tx, {
          email: customerEmail,
          name: customerName,
          document: customerDocument
        });

        const subscription = await tx.subscription.create({
          data: {
            customerId: customer.id,
            planId: plan.id,
            status: 'active',
            startAt: subscriptionStartAt,
            endAt: subscriptionEndAt,
            autoRenew: input.autoRenew ?? false,
            metadata: {
              source: 'admin_onboard',
              selection_mode: selectionMode
            } as Prisma.InputJsonValue
          }
        });

        const license = await this.createLicenseWithRetryInTransaction(tx, {
          subscriptionId: subscription.id,
          programCode: program.code,
          maxOfflineHours: input.maxOfflineHours ?? plan.maxOfflineHours
        });

        await tx.auditLog.create({
          data: {
            entityType: 'customer',
            entityId: customer.id,
            action: 'admin_customer_onboard',
            payload: {
              requested_by: requestedBy,
              customer_id: customer.id,
              selection_mode: selectionMode,
              plan_id: plan.id,
              program_id: program.id,
              subscription_id: subscription.id,
              license_id: license.id
            } as Prisma.InputJsonValue
          }
        });

        return {
          customer,
          endUser,
          subscription,
          plan,
          program,
          license
        };
      })
      .catch((error: unknown) => {
        if (error instanceof DomainHttpError) {
          throw error;
        }

        if (this.extractPrismaCode(error) === 'P2002') {
          this.throwDomainError(
            HttpStatus.CONFLICT,
            'customer_conflict',
            'Customer email already exists with conflicting data'
          );
        }

        throw error;
      });

    return {
      customer: {
        id: result.customer.id,
        email: result.customer.email,
        name: result.customer.name,
        document: result.customer.document,
        createdAt: result.customer.createdAt.toISOString(),
        updatedAt: result.customer.updatedAt.toISOString()
      },
      endUser: {
        id: result.endUser.id,
        customerId: result.endUser.customerId,
        identifier: result.endUser.identifier,
        status: result.endUser.status,
        createdAt: result.endUser.createdAt.toISOString(),
        updatedAt: result.endUser.updatedAt.toISOString()
      },
      subscription: {
        id: result.subscription.id,
        status: result.subscription.status,
        startAt: result.subscription.startAt.toISOString(),
        endAt: result.subscription.endAt.toISOString(),
        autoRenew: result.subscription.autoRenew
      },
      plan: {
        id: result.plan.id,
        code: result.plan.code,
        name: result.plan.name,
        maxDevices: result.plan.maxDevices,
        maxOfflineHours: result.plan.maxOfflineHours,
        features: this.toStringArray(result.plan.features)
      },
      program: {
        id: result.program.id,
        code: result.program.code,
        name: result.program.name,
        status: result.program.status
      },
      license: {
        id: result.license.id,
        licenseKey: result.license.licenseKey,
        status: result.license.status,
        maxOfflineHours: result.license.maxOfflineHours,
        transferCount: result.license.transferCount,
        createdAt: result.license.createdAt.toISOString(),
        updatedAt: result.license.updatedAt.toISOString()
      }
    };
  }

  async provisionLicense(input: ProvisionLicenseInput): Promise<AdminLicenseDetails> {
    const programCode = this.normalizeCode(input.programCode, 'program_code');
    const planCode = this.normalizeCode(input.planCode, 'plan_code');

    const program = await this.prisma.program.findFirst({
      where: {
        code: programCode,
        status: 'active'
      }
    });
    if (!program) {
      this.throwDomainError(HttpStatus.UNAUTHORIZED, 'unauthorized_program', 'Program is not active');
    }

    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode }
    });
    if (!plan) {
      this.throwDomainError(HttpStatus.NOT_FOUND, 'plan_not_found', 'Plan code not found');
    }

    const planProgram = await this.prisma.planProgram.findFirst({
      where: {
        planId: plan.id,
        programId: program.id
      }
    });
    if (!planProgram) {
      this.throwDomainError(
        HttpStatus.FORBIDDEN,
        'program_not_included',
        'Plan is not authorized for this program'
      );
    }

    const now = new Date();
    const startAt = input.subscription.startAt
      ? this.parseDate(input.subscription.startAt, 'subscription_start_at')
      : now;
    const endAt = this.parseDate(input.subscription.endAt, 'subscription_end_at');
    if (endAt <= startAt) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'subscription_end_at must be greater than subscription_start_at'
      );
    }

    const customerEmail = this.normalizeEmail(input.customer.email);
    const customerName = this.normalizeRequiredText(input.customer.name, 'customer.name');
    const customerDocument = this.normalizeOptionalText(input.customer.document);
    const maxOfflineHours = this.normalizePositiveInteger(
      input.maxOfflineHours !== undefined ? input.maxOfflineHours : plan.maxOfflineHours,
      'max_offline_hours'
    );

    const customer = await this.prisma.customer.upsert({
      where: { email: customerEmail },
      update: {
        name: customerName,
        document: customerDocument
      },
      create: {
        email: customerEmail,
        name: customerName,
        document: customerDocument
      }
    });

    const subscription = await this.prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: plan.id,
        status: 'active',
        startAt,
        endAt,
        autoRenew: input.subscription.autoRenew ?? false,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
      }
    });

    const license = await this.createLicenseWithRetry({
      subscriptionId: subscription.id,
      programCode: program.code,
      maxOfflineHours
    });

    await this.writeAuditLog({
      entityType: 'license',
      entityId: license.id,
      action: 'admin_license_provision',
      payload: {
        requested_by: input.requestedBy ?? 'internal-admin',
        program_code: program.code,
        plan_code: plan.code,
        customer_email: customer.email
      }
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async renewLicense(input: RenewLicenseInput): Promise<AdminLicenseDetails> {
    const context = await this.loadLicenseContext(input.licenseKey);
    const newEndAt = this.parseDate(input.newEndAt, 'new_end_at');
    if (newEndAt <= new Date()) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'new_end_at must be in the future'
      );
    }

    await this.prisma.subscription.update({
      where: { id: context.subscription.id },
      data: {
        status: 'active',
        endAt: newEndAt
      }
    });

    await this.writeAuditLog({
      entityType: 'license',
      entityId: context.license.id,
      action: 'admin_license_renew',
      payload: {
        requested_by: input.requestedBy ?? 'internal-admin',
        reason: input.reason ?? 'manual_renewal',
        new_end_at: newEndAt.toISOString()
      }
    });

    return this.getLicenseDetails({ licenseKey: input.licenseKey });
  }

  async blockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    const context = await this.loadLicenseContext(input.licenseKey);

    await this.prisma.license.update({
      where: { id: context.license.id },
      data: { status: 'blocked' }
    });

    await this.writeAuditLog({
      entityType: 'license',
      entityId: context.license.id,
      action: 'admin_license_block',
      payload: {
        requested_by: input.requestedBy ?? 'internal-admin',
        reason: input.reason ?? 'manual_block'
      }
    });

    return this.getLicenseDetails({ licenseKey: input.licenseKey });
  }

  async unblockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    const context = await this.loadLicenseContext(input.licenseKey);
    if (context.subscription.status !== 'active' || context.subscription.endAt <= new Date()) {
      this.throwDomainError(
        HttpStatus.FORBIDDEN,
        'subscription_expired',
        'Subscription is not eligible for unblocking'
      );
    }

    await this.prisma.license.update({
      where: { id: context.license.id },
      data: { status: 'active' }
    });

    await this.writeAuditLog({
      entityType: 'license',
      entityId: context.license.id,
      action: 'admin_license_unblock',
      payload: {
        requested_by: input.requestedBy ?? 'internal-admin',
        reason: input.reason ?? 'manual_unblock'
      }
    });

    return this.getLicenseDetails({ licenseKey: input.licenseKey });
  }

  async cancelLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    const context = await this.loadLicenseContext(input.licenseKey);

    await this.prisma.$transaction([
      this.prisma.license.update({
        where: { id: context.license.id },
        data: { status: 'inactive' }
      }),
      this.prisma.subscription.update({
        where: { id: context.subscription.id },
        data: { status: 'cancelled' }
      })
    ]);

    await this.writeAuditLog({
      entityType: 'license',
      entityId: context.license.id,
      action: 'admin_license_cancel',
      payload: {
        requested_by: input.requestedBy ?? 'internal-admin',
        reason: input.reason ?? 'manual_cancel'
      }
    });

    return this.getLicenseDetails({ licenseKey: input.licenseKey });
  }

  async getLicenseDetails(input: GetLicenseDetailsInput): Promise<AdminLicenseDetails> {
    const licenseKey = this.normalizeRequiredText(input.licenseKey, 'license_key');
    const license = await this.prisma.license.findUnique({
      where: { licenseKey },
      include: {
        subscription: {
          include: {
            plan: true,
            customer: true
          }
        },
        devices: {
          include: {
            fingerprint: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!license) {
      this.throwDomainError(HttpStatus.NOT_FOUND, 'license_not_found', 'License key not found');
    }

    const planFeatures = Array.isArray(license.subscription.plan.features)
      ? license.subscription.plan.features
          .filter((value): value is string => typeof value === 'string')
      : [];

    return {
      license: {
        id: license.id,
        licenseKey: license.licenseKey,
        status: license.status,
        maxOfflineHours: license.maxOfflineHours,
        transferCount: license.transferCount,
        createdAt: license.createdAt.toISOString(),
        updatedAt: license.updatedAt.toISOString()
      },
      subscription: {
        id: license.subscription.id,
        status: license.subscription.status,
        startAt: license.subscription.startAt.toISOString(),
        endAt: license.subscription.endAt.toISOString(),
        autoRenew: license.subscription.autoRenew
      },
      plan: {
        id: license.subscription.plan.id,
        code: license.subscription.plan.code,
        name: license.subscription.plan.name,
        maxDevices: license.subscription.plan.maxDevices,
        maxOfflineHours: license.subscription.plan.maxOfflineHours,
        features: planFeatures
      },
      customer: {
        id: license.subscription.customer.id,
        email: license.subscription.customer.email,
        name: license.subscription.customer.name,
        document: license.subscription.customer.document
      },
      devices: license.devices.map((device) => ({
        id: device.id,
        isActive: device.isActive,
        fingerprintHash: device.fingerprint.fingerprintHash,
        matchSource: device.matchSource,
        lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
        createdAt: device.createdAt.toISOString()
      }))
    };
  }

  async getOperationalSummary(
    input: GetOperationalSummaryInput = {}
  ): Promise<AdminOperationalSummary> {
    const windowDays = input.windowDays
      ? this.normalizePositiveInteger(input.windowDays, 'window_days')
      : 30;
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const now = new Date();

    const [
      customers,
      subscriptionsActive,
      licenses,
      licensesActive,
      devicesActive,
      validationFailures,
      securityEventsCritical,
      transferEvents,
      deactivateEvents
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.subscription.count({
        where: {
          status: 'active',
          endAt: { gt: now }
        }
      }),
      this.prisma.license.count(),
      this.prisma.license.count({
        where: { status: 'active' }
      }),
      this.prisma.licenseDevice.count({
        where: { isActive: true }
      }),
      this.prisma.validationHistory.count({
        where: {
          success: false,
          createdAt: { gte: windowStart }
        }
      }),
      this.prisma.securityEvent.count({
        where: {
          severity: 'critical',
          createdAt: { gte: windowStart }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          action: 'license_transfer',
          createdAt: { gte: windowStart }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          action: 'license_deactivate',
          createdAt: { gte: windowStart }
        }
      })
    ]);

    return {
      generatedAt: now.toISOString(),
      windowDays,
      totals: {
        customers,
        subscriptionsActive,
        licenses,
        licensesActive,
        devicesActive
      },
      recent: {
        validationFailures,
        securityEventsCritical,
        transferEvents,
        deactivateEvents
      }
    };
  }

  private async createProgramWithRetry(input: {
    name: string;
    description: string | null;
    metadata: Record<string, unknown>;
  }) {
    for (let attempt = 0; attempt < PrismaAdminBackofficeService.CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const code = this.generateProgramCode(input.name);
      try {
        return await this.prisma.program.create({
          data: {
            code,
            name: input.name,
            description: input.description,
            status: 'active',
            metadata: input.metadata as Prisma.InputJsonValue
          }
        });
      } catch (error: unknown) {
        if (this.extractPrismaCode(error) === 'P2002') {
          continue;
        }
        throw error;
      }
    }

    this.throwDomainError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'internal_error',
      'Failed to generate unique program code'
    );
  }

  private async createPlanWithRetry(input: {
    name: string;
    description: string | null;
    maxDevices: number;
    maxOfflineHours: number;
    features: string[];
    programIds: string[];
  }) {
    for (let attempt = 0; attempt < PrismaAdminBackofficeService.CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const code = this.generatePlanCode(input.name);
      try {
        return await this.prisma.plan.create({
          data: {
            code,
            name: input.name,
            description: input.description,
            isInternal: false,
            maxDevices: input.maxDevices,
            maxOfflineHours: input.maxOfflineHours,
            features: input.features as Prisma.InputJsonValue,
            planPrograms: {
              create: input.programIds.map((programId) => ({ programId }))
            }
          },
          include: {
            planPrograms: {
              include: { program: true }
            }
          }
        });
      } catch (error: unknown) {
        if (this.extractPrismaCode(error) === 'P2002') {
          continue;
        }
        throw error;
      }
    }

    this.throwDomainError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'internal_error',
      'Failed to generate unique plan code'
    );
  }

  private async upsertCustomerAndEndUser(
    tx: Prisma.TransactionClient,
    input: {
      email: string;
      name: string;
      document: string | null;
    }
  ) {
    const customer = await tx.customer.upsert({
      where: { email: input.email },
      update: {
        name: input.name,
        document: input.document
      },
      create: {
        email: input.email,
        name: input.name,
        document: input.document
      }
    });

    const identifier = input.email;
    let endUser = await tx.endUser.findUnique({
      where: {
        customerId_identifier: {
          customerId: customer.id,
          identifier
        }
      }
    });

    if (!endUser) {
      try {
        endUser = await tx.endUser.create({
          data: {
            customerId: customer.id,
            identifier,
            passwordHash: 'oidc_disabled',
            passwordSalt: 'oidc_disabled',
            hashVersion: 'oidc_v1',
            status: 'active'
          }
        });
      } catch (error: unknown) {
        if (this.extractPrismaCode(error) === 'P2002') {
          endUser = await tx.endUser.findUnique({
            where: {
              customerId_identifier: {
                customerId: customer.id,
                identifier
              }
            }
          });
        } else {
          throw error;
        }
      }
    }

    if (!endUser) {
      this.throwDomainError(
        HttpStatus.CONFLICT,
        'user_identifier_conflict',
        'User identifier already exists for this customer'
      );
    }

    return {
      customer,
      endUser
    };
  }

  private async resolveOnboardingSelection(
    tx: Prisma.TransactionClient,
    input: OnboardCustomerInput,
    selectionMode: 'plan' | 'individual_program'
  ) {
    if (selectionMode === 'individual_program') {
      const programId = this.normalizeRequiredText(input.programId ?? '', 'program_id');
      const program = await tx.program.findUnique({
        where: { id: programId }
      });
      if (!program || program.status !== 'active') {
        this.throwDomainError(HttpStatus.NOT_FOUND, 'program_not_found', 'Program not found');
      }

      const plan = await this.getOrCreateInternalPlanForProgram(tx, program);
      return { plan, program };
    }

    const planId = this.normalizeRequiredText(input.planId ?? '', 'plan_id');
    const plan = await tx.plan.findUnique({
      where: { id: planId },
      include: {
        planPrograms: {
          include: { program: true }
        }
      }
    });
    if (!plan) {
      this.throwDomainError(HttpStatus.NOT_FOUND, 'plan_not_found', 'Plan not found');
    }

    const availablePrograms = plan.planPrograms
      .map((planProgram) => planProgram.program)
      .filter((program) => program.status === 'active')
      .sort((left, right) => {
        const byName = left.name.localeCompare(right.name);
        if (byName !== 0) {
          return byName;
        }
        const byCode = left.code.localeCompare(right.code);
        if (byCode !== 0) {
          return byCode;
        }
        return left.id.localeCompare(right.id);
      });

    if (availablePrograms.length === 0) {
      this.throwDomainError(
        HttpStatus.FORBIDDEN,
        'program_not_included',
        'Plan is not authorized for this program'
      );
    }

    if (!input.programId) {
      return {
        plan,
        program: availablePrograms[0]
      };
    }

    const programId = this.normalizeRequiredText(input.programId, 'program_id');
    const program = availablePrograms.find((candidate) => candidate.id === programId);
    if (!program) {
      this.throwDomainError(
        HttpStatus.FORBIDDEN,
        'program_not_included',
        'Plan is not authorized for this program'
      );
    }

    return { plan, program };
  }

  private async getOrCreateInternalPlanForProgram(
    tx: Prisma.TransactionClient,
    program: { id: string; code: string; name: string }
  ) {
    const code = `__program_individual__${program.code}`;

    let plan = await tx.plan.findUnique({
      where: { code },
      include: {
        planPrograms: {
          include: { program: true }
        }
      }
    });

    if (!plan) {
      return tx.plan.create({
        data: {
          code,
          name: `Programa individual - ${program.name}`,
          description: `Plano interno para ${program.name}`,
          isInternal: true,
          maxDevices: 1,
          maxOfflineHours: 72,
          features: ['validate', 'heartbeat'] as Prisma.InputJsonValue,
          planPrograms: {
            create: [{ programId: program.id }]
          }
        },
        include: {
          planPrograms: {
            include: { program: true }
          }
        }
      });
    }

    await tx.plan.update({
      where: { id: plan.id },
      data: {
        name: `Programa individual - ${program.name}`,
        description: `Plano interno para ${program.name}`,
        isInternal: true,
        maxDevices: 1,
        maxOfflineHours: 72,
        features: ['validate', 'heartbeat'] as Prisma.InputJsonValue
      }
    });

    await tx.planProgram.deleteMany({
      where: {
        planId: plan.id,
        programId: {
          not: program.id
        }
      }
    });

    const existingLink = await tx.planProgram.findFirst({
      where: {
        planId: plan.id,
        programId: program.id
      }
    });

    if (!existingLink) {
      await tx.planProgram.create({
        data: {
          planId: plan.id,
          programId: program.id
        }
      });
    }

    return tx.plan.findUniqueOrThrow({
      where: { id: plan.id },
      include: {
        planPrograms: {
          include: { program: true }
        }
      }
    });
  }

  private async loadLicenseContext(licenseKeyInput: string): Promise<{
    license: { id: string };
    subscription: { id: string; status: string; endAt: Date };
  }> {
    const licenseKey = this.normalizeRequiredText(licenseKeyInput, 'license_key');
    const license = await this.prisma.license.findUnique({
      where: { licenseKey },
      include: {
        subscription: true
      }
    });

    if (!license) {
      this.throwDomainError(HttpStatus.NOT_FOUND, 'license_not_found', 'License key not found');
    }

    return {
      license: { id: license.id },
      subscription: {
        id: license.subscription.id,
        status: license.subscription.status,
        endAt: license.subscription.endAt
      }
    };
  }

  private async createLicenseWithRetryInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      subscriptionId: string;
      programCode: string;
      maxOfflineHours: number;
    }
  ): Promise<{
    id: string;
    licenseKey: string;
    status: string;
    maxOfflineHours: number;
    transferCount: number;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const maxOfflineHours = this.normalizePositiveInteger(input.maxOfflineHours, 'max_offline_hours');

    for (let attempt = 0; attempt < PrismaAdminBackofficeService.LICENSE_KEY_ATTEMPTS; attempt += 1) {
      const licenseKey = this.generateLicenseKey(input.programCode);

      try {
        const created = await tx.license.create({
          data: {
            subscriptionId: input.subscriptionId,
            licenseKey,
            status: 'active',
            maxOfflineHours
          }
        });

        return created;
      } catch (error: unknown) {
        if (this.extractPrismaCode(error) === 'P2002') {
          continue;
        }
        throw error;
      }
    }

    this.throwDomainError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'internal_error',
      'Failed to generate unique license key'
    );
  }

  private async createLicenseWithRetry(input: {
    subscriptionId: string;
    programCode: string;
    maxOfflineHours: number;
  }): Promise<{ id: string; licenseKey: string }> {
    for (let attempt = 0; attempt < PrismaAdminBackofficeService.LICENSE_KEY_ATTEMPTS; attempt += 1) {
      const licenseKey = this.generateLicenseKey(input.programCode);

      try {
        const created = await this.prisma.license.create({
          data: {
            subscriptionId: input.subscriptionId,
            licenseKey,
            status: 'active',
            maxOfflineHours: input.maxOfflineHours
          }
        });

        return {
          id: created.id,
          licenseKey: created.licenseKey
        };
      } catch (error: unknown) {
        const code = (error as { code?: string })?.code;
        if (code === 'P2002') {
          continue;
        }
        throw error;
      }
    }

    this.throwDomainError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'internal_error',
      'Failed to generate unique license key'
    );
  }

  private toProgramSummary(input: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: string;
    metadata: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }): AdminProgramSummary {
    return {
      id: input.id,
      code: input.code,
      name: input.name,
      description: input.description,
      status: input.status,
      metadata: this.toRecord(input.metadata),
      createdAt: input.createdAt.toISOString(),
      updatedAt: input.updatedAt.toISOString()
    };
  }

  private toPlanSummary(input: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    maxDevices: number;
    maxOfflineHours: number;
    features: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
    planPrograms: Array<{
      program: {
        id: string;
        code: string;
        name: string;
        description: string | null;
        status: string;
        metadata: Prisma.JsonValue;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
  }): AdminPlanSummary {
    return {
      id: input.id,
      code: input.code,
      name: input.name,
      description: input.description,
      maxDevices: input.maxDevices,
      maxOfflineHours: input.maxOfflineHours,
      features: this.toStringArray(input.features),
      createdAt: input.createdAt.toISOString(),
      updatedAt: input.updatedAt.toISOString(),
      programs: input.planPrograms
        .map((planProgram) => this.toProgramSummary(planProgram.program))
        .sort((left, right) => left.name.localeCompare(right.name))
    };
  }

  private toCustomerSummary(input: {
    id: string;
    email: string;
    name: string;
    document: string | null;
    createdAt: Date;
    updatedAt: Date;
    subscriptions: Array<{
      status: string;
      createdAt: Date;
      _count: { licenses: number };
    }>;
  }): AdminCustomerSummary {
    const licensesCount = input.subscriptions.reduce(
      (total, subscription) => total + subscription._count.licenses,
      0
    );

    return {
      id: input.id,
      email: input.email,
      name: input.name,
      document: input.document,
      createdAt: input.createdAt.toISOString(),
      updatedAt: input.updatedAt.toISOString(),
      licensesCount,
      lastSubscriptionStatus: input.subscriptions[0]?.status ?? null
    };
  }

  private async writeAuditLog(input: {
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        payload: input.payload as Prisma.InputJsonValue
      }
    });
  }

  private resolvePagination(input: {
    page?: number;
    pageSize?: number;
    query?: string;
  }): { page: number; pageSize: number; skip: number; query?: string } {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? PrismaAdminBackofficeService.DEFAULT_PAGE_SIZE;

    if (!Number.isInteger(page) || page <= 0) {
      this.throwDomainError(HttpStatus.BAD_REQUEST, 'invalid_request', 'page must be a positive integer');
    }

    if (!Number.isInteger(pageSize) || pageSize <= 0) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'page_size must be a positive integer'
      );
    }

    if (pageSize > PrismaAdminBackofficeService.MAX_PAGE_SIZE) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        `page_size must be <= ${PrismaAdminBackofficeService.MAX_PAGE_SIZE}`
      );
    }

    const query = this.normalizeOptionalText(input.query);

    return {
      page,
      pageSize,
      skip: (page - 1) * pageSize,
      query: query ?? undefined
    };
  }

  private normalizePositiveInteger(value: number, field: string): number {
    if (!Number.isInteger(value) || value <= 0) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        `${field} must be a positive integer`
      );
    }
    return value;
  }

  private normalizeMetadata(value: Record<string, unknown> | undefined): Record<string, unknown> {
    if (value === undefined) {
      return {};
    }

    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      this.throwDomainError(HttpStatus.BAD_REQUEST, 'invalid_request', 'metadata must be an object');
    }

    return value;
  }

  private normalizeFeatures(features: string[]): string[] {
    return features
      .map((feature) => this.normalizeRequiredText(feature, 'features'))
      .filter((feature, index, all) => all.indexOf(feature) === index);
  }

  private generateProgramCode(name: string): string {
    const slug = this.slugifyForCode(name).slice(0, 30);
    const suffix = randomBytes(2).toString('hex');
    return `${slug}-${suffix}`;
  }

  private generatePlanCode(name: string): string {
    const slug = this.slugifyForCode(name).slice(0, 30);
    const suffix = randomBytes(2).toString('hex');
    return `${slug}-${suffix}`;
  }

  private slugifyForCode(value: string): string {
    const normalized = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized.length > 0 ? normalized : 'item';
  }

  private toRecord(value: Prisma.JsonValue): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private toStringArray(value: Prisma.JsonValue): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private extractPrismaCode(error: unknown): string | undefined {
    return (error as { code?: string })?.code;
  }

  private generateLicenseKey(programCode: string): string {
    const normalizedProgram = programCode
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6) || 'GEN';
    const randomPart = randomBytes(6).toString('hex').toUpperCase();
    return `LIC-${normalizedProgram}-${randomPart}`;
  }

  private normalizeCode(input: string, field: string): string {
    const normalized = this.normalizeRequiredText(input, field).toLowerCase();
    if (!/^[a-z0-9_-]+$/i.test(normalized)) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        `${field} must be alphanumeric (including _ or -)`
      );
    }
    return normalized;
  }

  private normalizeEmail(email: string): string {
    const normalized = this.normalizeRequiredText(email, 'customer.email').toLowerCase();
    if (!normalized.includes('@')) {
      this.throwDomainError(HttpStatus.BAD_REQUEST, 'invalid_request', 'customer.email is invalid');
    }
    return normalized;
  }

  private normalizeRequiredText(value: string, field: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      this.throwDomainError(HttpStatus.BAD_REQUEST, 'invalid_request', `${field} is required`);
    }
    return normalized;
  }

  private normalizeOptionalText(value: string | undefined): string | null {
    if (!value) {
      return null;
    }
    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
  }

  private parseDate(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      this.throwDomainError(HttpStatus.BAD_REQUEST, 'invalid_request', `${field} must be a valid ISO date`);
    }
    return parsed;
  }

  private normalizeSelectionMode(value: string): 'plan' | 'individual_program' {
    if (value === 'plan' || value === 'individual_program') {
      return value;
    }

    this.throwDomainError(
      HttpStatus.BAD_REQUEST,
      'invalid_request',
      'selection_mode must be either plan or individual_program'
    );
  }

  private throwDomainError(status: HttpStatus, code: string, detail: string): never {
    throw new DomainHttpError({
      status,
      code,
      detail
    });
  }
}
