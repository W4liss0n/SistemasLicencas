import { HttpStatus } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { DomainHttpError } from '../../../../common/errors/domain-http-error';
import {
  AdminCustomerSummary,
  AdminPlanSummary,
  AdminProgramSummary,
  OnboardCustomerInput
} from '../../ports/admin-backoffice.port';

export type ProgramRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type PlanRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isInternal: boolean;
  maxDevices: number;
  maxOfflineHours: number;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerRecord = {
  id: string;
  email: string;
  name: string;
  document: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EndUserRecord = {
  id: string;
  customerId: string;
  identifier: string;
  status: 'active' | 'blocked';
  createdAt: Date;
  updatedAt: Date;
};

export type SubscriptionRecord = {
  id: string;
  customerId: string;
  planId: string;
  status: string;
  startAt: Date;
  endAt: Date;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type LicenseRecord = {
  id: string;
  subscriptionId: string;
  licenseKey: string;
  status: string;
  maxOfflineHours: number;
  transferCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type DeviceRecord = {
  id: string;
  licenseId: string;
  isActive: boolean;
  fingerprintHash: string;
  matchSource: string;
  createdAt: Date;
  lastSeenAt: Date | null;
};

export type AuditRecord = {
  action: string;
  createdAt: Date;
};

export class InMemoryAdminBackofficeState {
  private static readonly DEFAULT_PAGE_SIZE = 20;
  private static readonly MAX_PAGE_SIZE = 100;

  readonly programs = new Map<string, ProgramRecord>();
  readonly plans = new Map<string, PlanRecord>();
  readonly planPrograms = new Set<string>();
  readonly customersById = new Map<string, CustomerRecord>();
  readonly customerIdByEmail = new Map<string, string>();
  readonly endUsersById = new Map<string, EndUserRecord>();
  readonly endUserIdByKey = new Map<string, string>();
  readonly subscriptionsById = new Map<string, SubscriptionRecord>();
  readonly licensesById = new Map<string, LicenseRecord>();
  readonly licenseIdByKey = new Map<string, string>();
  readonly devicesByLicenseId = new Map<string, DeviceRecord[]>();
  readonly auditLogs: AuditRecord[] = [];
  readonly validationFailures: Date[] = [];
  readonly securityCriticalEvents: Date[] = [];

  constructor() {
    const now = new Date();
    const demoProgram: ProgramRecord = {
      id: '11111111-1111-4111-8111-111111111111',
      code: 'demo-program',
      name: 'Demo Program',
      description: 'Seed demo program',
      status: 'active',
      metadata: {},
      createdAt: now,
      updatedAt: now
    };
    const basicPlan: PlanRecord = {
      id: '22222222-2222-4222-8222-222222222222',
      code: 'basic',
      name: 'Basic',
      description: 'Plano basico',
      isInternal: false,
      maxDevices: 1,
      maxOfflineHours: 72,
      features: ['validate', 'heartbeat'],
      createdAt: now,
      updatedAt: now
    };
    const proPlan: PlanRecord = {
      id: '33333333-3333-4333-8333-333333333333',
      code: 'pro',
      name: 'Pro',
      description: 'Plano pro',
      isInternal: false,
      maxDevices: 2,
      maxOfflineHours: 168,
      features: ['validate', 'activate', 'heartbeat', 'transfer'],
      createdAt: now,
      updatedAt: now
    };
    const enterprisePlan: PlanRecord = {
      id: '44444444-4444-4444-8444-444444444444',
      code: 'enterprise',
      name: 'Enterprise',
      description: 'Plano enterprise',
      isInternal: false,
      maxDevices: 5,
      maxOfflineHours: 720,
      features: ['validate', 'activate', 'heartbeat', 'transfer', 'priority'],
      createdAt: now,
      updatedAt: now
    };

    this.programs.set(demoProgram.id, demoProgram);
    this.plans.set(basicPlan.id, basicPlan);
    this.plans.set(proPlan.id, proPlan);
    this.plans.set(enterprisePlan.id, enterprisePlan);
    this.planPrograms.add(this.planProgramKey(basicPlan.id, demoProgram.id));
    this.planPrograms.add(this.planProgramKey(proPlan.id, demoProgram.id));
  }

  toProgramSummary(input: ProgramRecord): AdminProgramSummary {
    return {
      id: input.id,
      code: input.code,
      name: input.name,
      description: input.description,
      status: input.status,
      metadata: { ...input.metadata },
      createdAt: input.createdAt.toISOString(),
      updatedAt: input.updatedAt.toISOString()
    };
  }

  toPlanSummary(input: PlanRecord): AdminPlanSummary {
    return {
      id: input.id,
      code: input.code,
      name: input.name,
      description: input.description,
      maxDevices: input.maxDevices,
      maxOfflineHours: input.maxOfflineHours,
      features: [...input.features],
      createdAt: input.createdAt.toISOString(),
      updatedAt: input.updatedAt.toISOString(),
      programs: this.getProgramsForPlan(input.id).map((program) => this.toProgramSummary(program))
    };
  }

  toCustomerSummary(input: CustomerRecord): AdminCustomerSummary {
    const subscriptions = Array.from(this.subscriptionsById.values())
      .filter((subscription) => subscription.customerId === input.id)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    const subscriptionIds = new Set(subscriptions.map((subscription) => subscription.id));
    const licensesCount = Array.from(this.licensesById.values()).filter((license) =>
      subscriptionIds.has(license.subscriptionId)
    ).length;

    return {
      id: input.id,
      email: input.email,
      name: input.name,
      document: input.document,
      createdAt: input.createdAt.toISOString(),
      updatedAt: input.updatedAt.toISOString(),
      licensesCount,
      lastSubscriptionStatus: subscriptions[0]?.status ?? null
    };
  }

  getProgramsForPlan(planId: string): ProgramRecord[] {
    return Array.from(this.planPrograms)
      .filter((entry) => entry.startsWith(`${planId}:`))
      .map((entry) => entry.split(':')[1])
      .map((programId) => this.programs.get(programId))
      .filter((program): program is ProgramRecord => program !== undefined)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  resolveOnboardingSelection(
    input: OnboardCustomerInput,
    selectionMode: 'plan' | 'individual_program'
  ): { plan: PlanRecord; program: ProgramRecord } {
    if (selectionMode === 'individual_program') {
      const programId = this.normalizeRequiredText(input.programId ?? '', 'program_id');
      const program = this.programs.get(programId);
      if (!program || program.status !== 'active') {
        this.throwDomainError(HttpStatus.NOT_FOUND, 'program_not_found', 'Program not found');
      }

      return {
        plan: this.getOrCreateInternalPlanForProgram(program),
        program
      };
    }

    const planId = this.normalizeRequiredText(input.planId ?? '', 'plan_id');
    const plan = this.plans.get(planId);
    if (!plan) {
      this.throwDomainError(HttpStatus.NOT_FOUND, 'plan_not_found', 'Plan not found');
    }

    const planPrograms = this.getProgramsForPlan(plan.id).filter((program) => program.status === 'active');
    if (planPrograms.length === 0) {
      this.throwDomainError(
        HttpStatus.FORBIDDEN,
        'program_not_included',
        'Plan is not authorized for this program'
      );
    }

    if (!input.programId) {
      return {
        plan,
        program: planPrograms[0]
      };
    }

    const programId = this.normalizeRequiredText(input.programId, 'program_id');
    const program = this.programs.get(programId);
    if (!program || program.status !== 'active') {
      this.throwDomainError(HttpStatus.NOT_FOUND, 'program_not_found', 'Program not found');
    }

    if (!this.planPrograms.has(this.planProgramKey(plan.id, program.id))) {
      this.throwDomainError(
        HttpStatus.FORBIDDEN,
        'program_not_included',
        'Plan is not authorized for this program'
      );
    }

    return { plan, program };
  }

  getOrCreateEndUser(customerId: string, identifierInput: string): EndUserRecord {
    const identifier = this.normalizeEmail(identifierInput);
    const key = this.endUserKey(customerId, identifier);
    const existingId = this.endUserIdByKey.get(key);
    if (existingId) {
      const existing = this.endUsersById.get(existingId);
      if (!existing) {
        this.throwDomainError(HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error', 'End user index is invalid');
      }
      return existing;
    }

    const now = new Date();
    const created: EndUserRecord = {
      id: randomUUID(),
      customerId,
      identifier,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    this.endUsersById.set(created.id, created);
    this.endUserIdByKey.set(key, created.id);
    return created;
  }

  createLicense(input: {
    subscriptionId: string;
    maxOfflineHours: number;
    programCode: string;
  }): LicenseRecord {
    const programCode = input.programCode
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6) || 'GEN';

    let licenseKey = '';
    do {
      const randomPart = randomBytes(6).toString('hex').toUpperCase();
      licenseKey = `LIC-${programCode}-${randomPart}`;
    } while (this.licenseIdByKey.has(licenseKey));

    const now = new Date();
    const license: LicenseRecord = {
      id: randomUUID(),
      subscriptionId: input.subscriptionId,
      licenseKey,
      status: 'active',
      maxOfflineHours: input.maxOfflineHours,
      transferCount: 0,
      createdAt: now,
      updatedAt: now
    };

    this.licensesById.set(license.id, license);
    this.licenseIdByKey.set(license.licenseKey, license.id);
    return license;
  }

  upsertCustomer(input: {
    email: string;
    name: string;
    document: string | null;
  }): CustomerRecord {
    const email = this.normalizeEmail(input.email);
    const name = this.normalizeRequiredText(input.name, 'customer.name');
    const document = input.document;

    const now = new Date();
    const existingId = this.customerIdByEmail.get(email);
    if (existingId) {
      const existing = this.customersById.get(existingId);
      if (!existing) {
        this.throwDomainError(HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error', 'Customer index is invalid');
      }

      existing.name = name;
      existing.document = document;
      existing.updatedAt = now;
      return existing;
    }

    const customer: CustomerRecord = {
      id: randomUUID(),
      email,
      name,
      document,
      createdAt: now,
      updatedAt: now
    };
    this.customersById.set(customer.id, customer);
    this.customerIdByEmail.set(email, customer.id);
    return customer;
  }

  findProgramByCode(code: string): ProgramRecord | undefined {
    const normalized = code.toLowerCase();
    return Array.from(this.programs.values()).find((program) => program.code === normalized);
  }

  findPlanByCode(code: string): PlanRecord | undefined {
    const normalized = code.toLowerCase();
    return Array.from(this.plans.values()).find((plan) => plan.code === normalized);
  }

  getOrCreateInternalPlanForProgram(program: ProgramRecord): PlanRecord {
    const code = `__program_individual__${program.code}`;
    const existing = this.findPlanByCode(code);
    if (existing) {
      if (!this.planPrograms.has(this.planProgramKey(existing.id, program.id))) {
        this.planPrograms.add(this.planProgramKey(existing.id, program.id));
      }
      return existing;
    }

    const now = new Date();
    const plan: PlanRecord = {
      id: randomUUID(),
      code,
      name: `Programa individual - ${program.name}`,
      description: `Plano interno para ${program.name}`,
      isInternal: true,
      maxDevices: 1,
      maxOfflineHours: 72,
      features: ['validate', 'heartbeat'],
      createdAt: now,
      updatedAt: now
    };

    this.plans.set(plan.id, plan);
    this.planPrograms.add(this.planProgramKey(plan.id, program.id));
    return plan;
  }

  getLicenseByKey(licenseKeyInput: string): LicenseRecord {
    const licenseKey = this.normalizeRequiredText(licenseKeyInput, 'license_key');
    const licenseId = this.licenseIdByKey.get(licenseKey);
    if (!licenseId) {
      this.throwDomainError(HttpStatus.NOT_FOUND, 'license_not_found', 'License key not found');
    }

    const license = this.licensesById.get(licenseId);
    if (!license) {
      this.throwDomainError(HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error', 'License index is invalid');
    }
    return license;
  }

  getSubscription(subscriptionId: string): SubscriptionRecord {
    const subscription = this.subscriptionsById.get(subscriptionId);
    if (!subscription) {
      this.throwDomainError(HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error', 'Subscription not found');
    }
    return subscription;
  }

  getCustomer(customerId: string): CustomerRecord {
    const customer = this.customersById.get(customerId);
    if (!customer) {
      this.throwDomainError(HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error', 'Customer not found');
    }
    return customer;
  }

  getPlan(planId: string): PlanRecord {
    const plan = this.plans.get(planId);
    if (!plan) {
      this.throwDomainError(HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error', 'Plan not found');
    }
    return plan;
  }

  resolvePagination(input: {
    page?: number;
    pageSize?: number;
    query?: string;
  }): { page: number; pageSize: number; skip: number; query?: string } {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? InMemoryAdminBackofficeState.DEFAULT_PAGE_SIZE;

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

    if (pageSize > InMemoryAdminBackofficeState.MAX_PAGE_SIZE) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        `page_size must be <= ${InMemoryAdminBackofficeState.MAX_PAGE_SIZE}`
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

  createUniqueCode(
    isUsed: (code: string) => boolean,
    generator: () => string
  ): string {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = generator();
      if (!isUsed(candidate)) {
        return candidate;
      }
    }

    this.throwDomainError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'internal_error',
      'Failed to generate unique code'
    );
  }

  generateProgramCode(name: string): () => string {
    return () => {
      const slug = this.slugifyForCode(name).slice(0, 30);
      const suffix = randomBytes(2).toString('hex');
      return `${slug}-${suffix}`;
    };
  }

  generatePlanCode(name: string): () => string {
    return () => {
      const slug = this.slugifyForCode(name).slice(0, 30);
      const suffix = randomBytes(2).toString('hex');
      return `${slug}-${suffix}`;
    };
  }

  slugifyForCode(value: string): string {
    const normalized = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized.length > 0 ? normalized : 'item';
  }

  parseDate(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      this.throwDomainError(HttpStatus.BAD_REQUEST, 'invalid_request', `${field} must be a valid ISO date`);
    }
    return parsed;
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
    return normalized.length > 0 ? normalized : null;
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

  normalizeFeatures(features: string[]): string[] {
    return features
      .map((feature) => this.normalizeRequiredText(feature, 'features'))
      .filter((feature, index, all) => all.indexOf(feature) === index);
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

  planProgramKey(planId: string, programId: string): string {
    return `${planId}:${programId}`;
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

  resolveSubscriptionStatusForEdit(
    currentStatus: string,
    nextEndAt: Date,
    now: Date
  ): string {
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

  resolveLicenseStatusForEdit(currentStatus: string, subscriptionStatus: string): string {
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

  endUserKey(customerId: string, identifier: string): string {
    return `${customerId}:${identifier}`;
  }

  throwDomainError(status: HttpStatus, code: string, detail: string): never {
    throw new DomainHttpError({
      status,
      code,
      detail
    });
  }
}
