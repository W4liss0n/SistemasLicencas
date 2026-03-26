import { HttpStatus } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { DomainHttpError } from '../../../../common/errors/domain-http-error';
import type { PrismaService } from '../../../../infra/prisma/prisma.service';
import type {
  AdminCustomerSummary,
  AdminPlanSummary,
  AdminProgramSummary,
  OnboardCustomerInput
} from '../../ports/admin-backoffice.port';

export type ProgramSummaryRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

export type PlanSummaryRecord = {
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
    program: ProgramSummaryRecord;
  }>;
};

export type CustomerSummaryRecord = {
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
};

export type InternalProgramRecord = {
  id: string;
  code: string;
  name: string;
  status: string;
};

export type InternalPlanRecord = {
  id: string;
  code: string;
  name: string;
  maxDevices: number;
  maxOfflineHours: number;
  features: Prisma.JsonValue;
};

export type PrismaAdminPagination = {
  page: number;
  pageSize: number;
  skip: number;
  query?: string;
};

export type PrismaAdminLicenseContext = {
  license: { id: string; status: string };
  subscription: { id: string; status: string; startAt: Date; endAt: Date };
};

export class PrismaAdminBackofficeSupport {
  static readonly LICENSE_KEY_ATTEMPTS = 8;
  static readonly CODE_GENERATION_ATTEMPTS = 8;
  static readonly DEFAULT_PAGE_SIZE = 20;
  static readonly MAX_PAGE_SIZE = 100;

  constructor(private readonly prisma: PrismaService) {}

  async createProgramWithRetry(input: {
    name: string;
    description: string | null;
    metadata: Record<string, unknown>;
  }) {
    for (
      let attempt = 0;
      attempt < PrismaAdminBackofficeSupport.CODE_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
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

  async createPlanWithRetry(input: {
    name: string;
    description: string | null;
    maxDevices: number;
    maxOfflineHours: number;
    features: string[];
    programIds: string[];
  }) {
    for (
      let attempt = 0;
      attempt < PrismaAdminBackofficeSupport.CODE_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
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

  async upsertCustomerAndEndUser(
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

  async resolveOnboardingSelection(
    tx: Prisma.TransactionClient,
    input: OnboardCustomerInput,
    selectionMode: 'plan' | 'individual_program'
  ): Promise<{ plan: InternalPlanRecord; program: InternalProgramRecord }> {
    if (selectionMode === 'individual_program') {
      const programId = this.normalizeRequiredText(input.programId ?? '', 'program_id');
      const program = await tx.program.findUnique({
        where: { id: programId }
      });
      if (!program || program.status !== 'active') {
        this.throwDomainError(HttpStatus.NOT_FOUND, 'program_not_found', 'Program not found');
      }

      const plan = await this.getOrCreateInternalPlanForProgram(tx, program);
      return {
        plan,
        program: {
          id: program.id,
          code: program.code,
          name: program.name,
          status: program.status
        }
      };
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
        plan: {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          maxDevices: plan.maxDevices,
          maxOfflineHours: plan.maxOfflineHours,
          features: plan.features
        },
        program: {
          id: availablePrograms[0].id,
          code: availablePrograms[0].code,
          name: availablePrograms[0].name,
          status: availablePrograms[0].status
        }
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

    return {
      plan: {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        maxDevices: plan.maxDevices,
        maxOfflineHours: plan.maxOfflineHours,
        features: plan.features
      },
      program: {
        id: program.id,
        code: program.code,
        name: program.name,
        status: program.status
      }
    };
  }

  async getOrCreateInternalPlanForProgram(
    tx: Prisma.TransactionClient,
    program: { id: string; code: string; name: string }
  ): Promise<InternalPlanRecord> {
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
      const created = await tx.plan.create({
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

      return {
        id: created.id,
        code: created.code,
        name: created.name,
        maxDevices: created.maxDevices,
        maxOfflineHours: created.maxOfflineHours,
        features: created.features
      };
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

    plan = await tx.plan.findUniqueOrThrow({
      where: { id: plan.id },
      include: {
        planPrograms: {
          include: { program: true }
        }
      }
    });

    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      maxDevices: plan.maxDevices,
      maxOfflineHours: plan.maxOfflineHours,
      features: plan.features
    };
  }

  async loadLicenseContext(licenseKeyInput: string): Promise<PrismaAdminLicenseContext> {
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
      license: {
        id: license.id,
        status: license.status
      },
      subscription: {
        id: license.subscription.id,
        status: license.subscription.status,
        startAt: license.subscription.startAt,
        endAt: license.subscription.endAt
      }
    };
  }

  async createLicenseWithRetryInTransaction(
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

    for (
      let attempt = 0;
      attempt < PrismaAdminBackofficeSupport.LICENSE_KEY_ATTEMPTS;
      attempt += 1
    ) {
      const licenseKey = this.generateLicenseKey(input.programCode);

      try {
        return await tx.license.create({
          data: {
            subscriptionId: input.subscriptionId,
            licenseKey,
            status: 'active',
            maxOfflineHours
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
      'Failed to generate unique license key'
    );
  }

  async createLicenseWithRetry(input: {
    subscriptionId: string;
    programCode: string;
    maxOfflineHours: number;
  }): Promise<{ id: string; licenseKey: string }> {
    for (
      let attempt = 0;
      attempt < PrismaAdminBackofficeSupport.LICENSE_KEY_ATTEMPTS;
      attempt += 1
    ) {
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

  toProgramSummary(input: ProgramSummaryRecord): AdminProgramSummary {
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

  toPlanSummary(input: PlanSummaryRecord): AdminPlanSummary {
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

  toCustomerSummary(input: CustomerSummaryRecord): AdminCustomerSummary {
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

  async writeAuditLog(input: {
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

  resolvePagination(input: {
    page?: number;
    pageSize?: number;
    query?: string;
  }): PrismaAdminPagination {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? PrismaAdminBackofficeSupport.DEFAULT_PAGE_SIZE;

    if (!Number.isInteger(page) || page <= 0) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'page must be a positive integer'
      );
    }

    if (!Number.isInteger(pageSize) || pageSize <= 0) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'page_size must be a positive integer'
      );
    }

    if (pageSize > PrismaAdminBackofficeSupport.MAX_PAGE_SIZE) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        `page_size must be <= ${PrismaAdminBackofficeSupport.MAX_PAGE_SIZE}`
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

  resolveSubscriptionStatusForEdit(
    currentStatus: string,
    nextEndAt: Date,
    now: Date
  ): 'active' | 'suspended' | 'cancelled' | 'expired' {
    if (currentStatus === 'cancelled') {
      return 'cancelled';
    }

    if (nextEndAt <= now) {
      return 'expired';
    }

    if (currentStatus === 'suspended') {
      return 'suspended';
    }

    return 'active';
  }

  resolveLicenseStatusForEdit(
    currentStatus: string,
    subscriptionStatus: string
  ): 'active' | 'inactive' | 'blocked' | 'expired' {
    if (currentStatus === 'blocked') {
      return 'blocked';
    }

    if (currentStatus === 'inactive') {
      return 'inactive';
    }

    if (subscriptionStatus === 'expired') {
      return 'expired';
    }

    return 'active';
  }

  normalizePositiveInteger(value: number, field: string): number {
    if (!Number.isInteger(value) || value <= 0) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        `${field} must be a positive integer`
      );
    }

    return value;
  }

  normalizeMetadata(value: Record<string, unknown> | undefined): Record<string, unknown> {
    if (value === undefined) {
      return {};
    }

    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      this.throwDomainError(HttpStatus.BAD_REQUEST, 'invalid_request', 'metadata must be an object');
    }

    return value;
  }

  normalizeFeatures(features: string[]): string[] {
    return features
      .map((feature) => this.normalizeRequiredText(feature, 'features'))
      .filter((feature, index, all) => all.indexOf(feature) === index);
  }

  generateProgramCode(name: string): string {
    const slug = this.slugifyForCode(name).slice(0, 30);
    const suffix = randomBytes(2).toString('hex');
    return `${slug}-${suffix}`;
  }

  generatePlanCode(name: string): string {
    const slug = this.slugifyForCode(name).slice(0, 30);
    const suffix = randomBytes(2).toString('hex');
    return `${slug}-${suffix}`;
  }

  toRecord(value: Prisma.JsonValue): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  toStringArray(value: Prisma.JsonValue): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  extractPrismaCode(error: unknown): string | undefined {
    return (error as { code?: string })?.code;
  }

  generateLicenseKey(programCode: string): string {
    const normalizedProgram =
      programCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'GEN';
    const randomPart = randomBytes(6).toString('hex').toUpperCase();
    return `LIC-${normalizedProgram}-${randomPart}`;
  }

  normalizeCode(input: string, field: string): string {
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

  normalizeEmail(email: string): string {
    const normalized = this.normalizeRequiredText(email, 'customer.email').toLowerCase();
    if (!normalized.includes('@')) {
      this.throwDomainError(HttpStatus.BAD_REQUEST, 'invalid_request', 'customer.email is invalid');
    }

    return normalized;
  }

  normalizeRequiredText(value: string, field: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      this.throwDomainError(HttpStatus.BAD_REQUEST, 'invalid_request', `${field} is required`);
    }

    return normalized;
  }

  normalizeOptionalText(value: string | undefined): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
  }

  parseDate(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        `${field} must be a valid ISO date`
      );
    }

    return parsed;
  }

  normalizeSelectionMode(value: string): 'plan' | 'individual_program' {
    if (value === 'plan' || value === 'individual_program') {
      return value;
    }

    this.throwDomainError(
      HttpStatus.BAD_REQUEST,
      'invalid_request',
      'selection_mode must be either plan or individual_program'
    );
  }

  throwDomainError(status: HttpStatus, code: string, detail: string): never {
    throw new DomainHttpError({
      status,
      code,
      detail
    });
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
}
