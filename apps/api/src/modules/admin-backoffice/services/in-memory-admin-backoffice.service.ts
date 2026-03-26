import { HttpStatus, Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
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
  GetLicenseDetailsInput,
  GetOperationalSummaryInput,
  GetCustomerDetailsInput,
  LicenseActionInput,
  ListCustomersInput,
  ListPlansInput,
  ListProgramsInput,
  OnboardCustomerInput,
  PaginatedResult,
  ProvisionLicenseInput,
  RenewLicenseInput,
  UpdateLicenseInput,
  UpdatePlanInput
} from '../ports/admin-backoffice.port';

type ProgramRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type PlanRecord = {
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

type CustomerRecord = {
  id: string;
  email: string;
  name: string;
  document: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type EndUserRecord = {
  id: string;
  customerId: string;
  identifier: string;
  status: 'active' | 'blocked';
  createdAt: Date;
  updatedAt: Date;
};

type SubscriptionRecord = {
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

type LicenseRecord = {
  id: string;
  subscriptionId: string;
  licenseKey: string;
  status: string;
  maxOfflineHours: number;
  transferCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type DeviceRecord = {
  id: string;
  licenseId: string;
  isActive: boolean;
  fingerprintHash: string;
  matchSource: string;
  createdAt: Date;
  lastSeenAt: Date | null;
};

type AuditRecord = {
  action: string;
  createdAt: Date;
};

@Injectable()
export class InMemoryAdminBackofficeService implements AdminBackofficePort {
  private static readonly DEFAULT_PAGE_SIZE = 20;
  private static readonly MAX_PAGE_SIZE = 100;

  private readonly programs = new Map<string, ProgramRecord>();
  private readonly plans = new Map<string, PlanRecord>();
  private readonly planPrograms = new Set<string>();
  private readonly customersById = new Map<string, CustomerRecord>();
  private readonly customerIdByEmail = new Map<string, string>();
  private readonly endUsersById = new Map<string, EndUserRecord>();
  private readonly endUserIdByKey = new Map<string, string>();
  private readonly subscriptionsById = new Map<string, SubscriptionRecord>();
  private readonly licensesById = new Map<string, LicenseRecord>();
  private readonly licenseIdByKey = new Map<string, string>();
  private readonly devicesByLicenseId = new Map<string, DeviceRecord[]>();
  private readonly auditLogs: AuditRecord[] = [];
  private readonly validationFailures: Date[] = [];
  private readonly securityCriticalEvents: Date[] = [];

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

  async createProgram(input: CreateProgramInput): Promise<AdminProgramSummary> {
    const name = this.normalizeRequiredText(input.name, 'name');
    const description = this.normalizeOptionalText(input.description);
    const metadata = this.normalizeMetadata(input.metadata);
    const code = this.createUniqueCode(
      (candidate) => Array.from(this.programs.values()).some((program) => program.code === candidate),
      this.generateProgramCode(name)
    );

    const now = new Date();
    const program: ProgramRecord = {
      id: randomUUID(),
      code,
      name,
      description,
      status: 'active',
      metadata,
      createdAt: now,
      updatedAt: now
    };

    this.programs.set(program.id, program);
    this.auditLogs.push({ action: 'admin_program_create', createdAt: now });

    return this.toProgramSummary(program);
  }

  async listPrograms(input: ListProgramsInput): Promise<PaginatedResult<AdminProgramSummary>> {
    const pagination = this.resolvePagination(input);
    const q = pagination.query?.toLowerCase();
    const filtered = Array.from(this.programs.values())
      .filter((program) => {
        if (!q) {
          return true;
        }
        return (
          program.code.toLowerCase().includes(q) ||
          program.name.toLowerCase().includes(q) ||
          (program.description ?? '').toLowerCase().includes(q)
        );
      })
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    const pageItems = filtered.slice(pagination.skip, pagination.skip + pagination.pageSize);

    return {
      items: pageItems.map((item) => this.toProgramSummary(item)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: filtered.length
    };
  }

  async createPlan(input: CreatePlanInput): Promise<AdminPlanSummary> {
    const name = this.normalizeRequiredText(input.name, 'name');
    const description = this.normalizeOptionalText(input.description);
    const maxDevices = this.normalizePositiveInteger(input.maxDevices, 'max_devices');
    const maxOfflineHours = this.normalizePositiveInteger(input.maxOfflineHours, 'max_offline_hours');
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

    for (const programId of programIds) {
      const program = this.programs.get(programId);
      if (!program) {
        this.throwDomainError(HttpStatus.NOT_FOUND, 'program_not_found', 'Program not found');
      }
    }

    const code = this.createUniqueCode(
      (candidate) => Array.from(this.plans.values()).some((plan) => plan.code === candidate),
      this.generatePlanCode(name)
    );

    const now = new Date();
    const plan: PlanRecord = {
      id: randomUUID(),
      code,
      name,
      description,
      isInternal: false,
      maxDevices,
      maxOfflineHours,
      features,
      createdAt: now,
      updatedAt: now
    };

    this.plans.set(plan.id, plan);
    for (const programId of programIds) {
      this.planPrograms.add(this.planProgramKey(plan.id, programId));
    }
    this.auditLogs.push({ action: 'admin_plan_create', createdAt: now });

    return this.toPlanSummary(plan);
  }

  async updatePlan(input: UpdatePlanInput): Promise<AdminPlanSummary> {
    const planId = this.normalizeRequiredText(input.planId, 'plan_id');
    const plan = this.plans.get(planId);
    if (!plan || plan.isInternal) {
      this.throwDomainError(HttpStatus.NOT_FOUND, 'plan_not_found', 'Plan not found');
    }

    const name = this.normalizeRequiredText(input.name, 'name');
    const description = this.normalizeOptionalText(input.description);
    const maxDevices = this.normalizePositiveInteger(input.maxDevices, 'max_devices');
    const maxOfflineHours = this.normalizePositiveInteger(input.maxOfflineHours, 'max_offline_hours');
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

    for (const programId of programIds) {
      const program = this.programs.get(programId);
      if (!program) {
        this.throwDomainError(HttpStatus.NOT_FOUND, 'program_not_found', 'Program not found');
      }
    }

    plan.name = name;
    plan.description = description;
    plan.maxDevices = maxDevices;
    plan.maxOfflineHours = maxOfflineHours;
    plan.features = features;
    plan.updatedAt = new Date();

    for (const link of Array.from(this.planPrograms)) {
      if (link.startsWith(`${plan.id}:`)) {
        this.planPrograms.delete(link);
      }
    }

    for (const programId of programIds) {
      this.planPrograms.add(this.planProgramKey(plan.id, programId));
    }

    this.auditLogs.push({ action: 'admin_plan_update', createdAt: new Date() });

    return this.toPlanSummary(plan);
  }

  async listPlans(input: ListPlansInput): Promise<PaginatedResult<AdminPlanSummary>> {
    const pagination = this.resolvePagination(input);
    const q = pagination.query?.toLowerCase();
    const filtered = Array.from(this.plans.values())
      .filter((plan) => !plan.isInternal)
      .filter((plan) => {
        if (!q) {
          return true;
        }
        return (
          plan.code.toLowerCase().includes(q) ||
          plan.name.toLowerCase().includes(q) ||
          (plan.description ?? '').toLowerCase().includes(q)
        );
      })
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    const pageItems = filtered.slice(pagination.skip, pagination.skip + pagination.pageSize);

    return {
      items: pageItems.map((item) => this.toPlanSummary(item)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: filtered.length
    };
  }

  async listCustomers(input: ListCustomersInput): Promise<PaginatedResult<AdminCustomerSummary>> {
    const pagination = this.resolvePagination(input);
    const q = pagination.query?.toLowerCase();
    const filtered = Array.from(this.customersById.values())
      .filter((customer) => {
        if (!q) {
          return true;
        }
        return (
          customer.email.toLowerCase().includes(q) ||
          customer.name.toLowerCase().includes(q) ||
          (customer.document ?? '').toLowerCase().includes(q)
        );
      })
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    const pageItems = filtered.slice(pagination.skip, pagination.skip + pagination.pageSize);

    return {
      items: pageItems.map((item) => this.toCustomerSummary(item)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: filtered.length
    };
  }

  async getCustomerDetails(input: GetCustomerDetailsInput): Promise<AdminCustomerDetails> {
    const customerId = this.normalizeRequiredText(input.customerId, 'customer_id');
    const customer = this.customersById.get(customerId);
    if (!customer) {
      this.throwDomainError(HttpStatus.NOT_FOUND, 'customer_not_found', 'Customer not found');
    }
    const subscriptions = Array.from(this.subscriptionsById.values())
      .filter((subscription) => subscription.customerId === customer.id)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return {
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        document: customer.document,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString()
      },
      licenses: subscriptions.flatMap((subscription) => {
        const plan = this.getPlan(subscription.planId);
        const programs = this.getProgramsForPlan(plan.id).map((program) => this.toProgramSummary(program));
        const licenses = Array.from(this.licensesById.values())
          .filter((license) => license.subscriptionId === subscription.id)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

        return licenses.map((license) => ({
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
            id: plan.id,
            code: plan.code,
            name: plan.name,
            maxDevices: plan.maxDevices,
            maxOfflineHours: plan.maxOfflineHours,
            features: [...plan.features]
          },
          programs,
          devices: (this.devicesByLicenseId.get(license.id) ?? []).map((device) => ({
            id: device.id,
            isActive: device.isActive,
            fingerprintHash: device.fingerprintHash,
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

    const customer = this.upsertCustomer({
      email: customerEmail,
      name: customerName,
      document: customerDocument
    });
    const endUser = this.getOrCreateEndUser(customer.id, customer.email);
    this.auditLogs.push({ action: 'admin_customer_create', createdAt: new Date() });

    return {
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        document: customer.document,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString()
      },
      endUser: {
        id: endUser.id,
        customerId: endUser.customerId,
        identifier: endUser.identifier,
        status: endUser.status,
        createdAt: endUser.createdAt.toISOString(),
        updatedAt: endUser.updatedAt.toISOString()
      }
    };
  }

  async onboardCustomer(input: OnboardCustomerInput): Promise<AdminOnboardCustomerResult> {
    const customerEmail = this.normalizeEmail(input.customer.email);
    const customerName = this.normalizeRequiredText(input.customer.name, 'customer.name');
    const customerDocument = this.normalizeOptionalText(input.customer.document);
    const selectionMode = this.normalizeSelectionMode(input.selectionMode);
    const startAt = input.subscriptionStartAt
      ? this.parseDate(input.subscriptionStartAt, 'subscription_start_at')
      : new Date();
    const endAt = this.parseDate(input.subscriptionEndAt, 'subscription_end_at');

    if (endAt <= startAt) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'subscription_end_at must be greater than subscription_start_at'
      );
    }

    const { plan, program } = this.resolveOnboardingSelection(input, selectionMode);

    const customer = this.upsertCustomer({
      email: customerEmail,
      name: customerName,
      document: customerDocument
    });

    const endUser = this.getOrCreateEndUser(customer.id, customer.email);

    const now = new Date();
    const subscription: SubscriptionRecord = {
      id: randomUUID(),
      customerId: customer.id,
      planId: plan.id,
      status: 'active',
      startAt,
      endAt,
      autoRenew: input.autoRenew ?? false,
      createdAt: now,
      updatedAt: now
    };
    this.subscriptionsById.set(subscription.id, subscription);

    const maxOfflineHours = this.normalizePositiveInteger(
      input.maxOfflineHours ?? plan.maxOfflineHours,
      'max_offline_hours'
    );

    const license = this.createLicense({
      subscriptionId: subscription.id,
      maxOfflineHours,
      programCode: program.code
    });

    this.auditLogs.push({ action: 'admin_customer_onboard', createdAt: now });

    return {
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        document: customer.document,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString()
      },
      endUser: {
        id: endUser.id,
        customerId: endUser.customerId,
        identifier: endUser.identifier,
        status: endUser.status,
        createdAt: endUser.createdAt.toISOString(),
        updatedAt: endUser.updatedAt.toISOString()
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        startAt: subscription.startAt.toISOString(),
        endAt: subscription.endAt.toISOString(),
        autoRenew: subscription.autoRenew
      },
      plan: {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        maxDevices: plan.maxDevices,
        maxOfflineHours: plan.maxOfflineHours,
        features: [...plan.features]
      },
      program: {
        id: program.id,
        code: program.code,
        name: program.name,
        status: program.status
      },
      license: {
        id: license.id,
        licenseKey: license.licenseKey,
        status: license.status,
        maxOfflineHours: license.maxOfflineHours,
        transferCount: license.transferCount,
        createdAt: license.createdAt.toISOString(),
        updatedAt: license.updatedAt.toISOString()
      }
    };
  }

  async provisionLicense(input: ProvisionLicenseInput): Promise<AdminLicenseDetails> {
    const programCode = this.normalizeCode(input.programCode, 'program_code');
    const planCode = this.normalizeCode(input.planCode, 'plan_code');

    const program = this.findProgramByCode(programCode);
    if (!program || program.status !== 'active') {
      this.throwDomainError(HttpStatus.UNAUTHORIZED, 'unauthorized_program', 'Program is not active');
    }

    const plan = this.findPlanByCode(planCode);
    if (!plan) {
      this.throwDomainError(HttpStatus.NOT_FOUND, 'plan_not_found', 'Plan code not found');
    }

    if (!this.planPrograms.has(this.planProgramKey(plan.id, program.id))) {
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

    const customer = this.upsertCustomer({
      email: input.customer.email,
      name: input.customer.name,
      document: this.normalizeOptionalText(input.customer.document)
    });

    const subscription: SubscriptionRecord = {
      id: randomUUID(),
      customerId: customer.id,
      planId: plan.id,
      status: 'active',
      startAt,
      endAt,
      autoRenew: input.subscription.autoRenew ?? false,
      createdAt: now,
      updatedAt: now
    };
    this.subscriptionsById.set(subscription.id, subscription);

    const maxOfflineHours = this.normalizePositiveInteger(
      input.maxOfflineHours ?? plan.maxOfflineHours,
      'max_offline_hours'
    );

    const license = this.createLicense({
      subscriptionId: subscription.id,
      maxOfflineHours,
      programCode: program.code
    });

    this.auditLogs.push({
      action: 'admin_license_provision',
      createdAt: now
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async renewLicense(input: RenewLicenseInput): Promise<AdminLicenseDetails> {
    const license = this.getLicenseByKey(input.licenseKey);
    const subscription = this.getSubscription(license.subscriptionId);
    const newEndAt = this.parseDate(input.newEndAt, 'new_end_at');
    if (newEndAt <= new Date()) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'new_end_at must be in the future'
      );
    }

    subscription.endAt = newEndAt;
    subscription.status = 'active';
    subscription.updatedAt = new Date();
    license.updatedAt = new Date();
    this.auditLogs.push({
      action: 'admin_license_renew',
      createdAt: new Date()
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async updateLicense(input: UpdateLicenseInput): Promise<AdminLicenseDetails> {
    const license = this.getLicenseByKey(input.licenseKey);
    const subscription = this.getSubscription(license.subscriptionId);
    const nextEndAt = this.parseDate(input.subscriptionEndAt, 'subscription_end_at');
    const maxOfflineHours = this.normalizePositiveInteger(input.maxOfflineHours, 'max_offline_hours');

    if (nextEndAt <= subscription.startAt) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'subscription_end_at must be greater than subscription_start_at'
      );
    }

    const now = new Date();
    subscription.endAt = nextEndAt;
    subscription.autoRenew = input.autoRenew;
    subscription.status = this.resolveSubscriptionStatusForEdit(subscription.status, nextEndAt, now);
    subscription.updatedAt = now;

    license.maxOfflineHours = maxOfflineHours;
    license.status = this.resolveLicenseStatusForEdit(license.status, subscription.status);
    license.updatedAt = now;

    this.auditLogs.push({
      action: 'admin_license_update',
      createdAt: now
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async blockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    const license = this.getLicenseByKey(input.licenseKey);
    license.status = 'blocked';
    license.updatedAt = new Date();
    this.auditLogs.push({
      action: 'admin_license_block',
      createdAt: new Date()
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async unblockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    const license = this.getLicenseByKey(input.licenseKey);
    const subscription = this.getSubscription(license.subscriptionId);

    if (subscription.status !== 'active' || subscription.endAt <= new Date()) {
      this.throwDomainError(
        HttpStatus.FORBIDDEN,
        'subscription_expired',
        'Subscription is not eligible for unblocking'
      );
    }

    license.status = 'active';
    license.updatedAt = new Date();
    this.auditLogs.push({
      action: 'admin_license_unblock',
      createdAt: new Date()
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async cancelLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    const license = this.getLicenseByKey(input.licenseKey);
    const subscription = this.getSubscription(license.subscriptionId);

    license.status = 'inactive';
    license.updatedAt = new Date();
    subscription.status = 'cancelled';
    subscription.updatedAt = new Date();
    this.auditLogs.push({
      action: 'admin_license_cancel',
      createdAt: new Date()
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async getLicenseDetails(input: GetLicenseDetailsInput): Promise<AdminLicenseDetails> {
    const license = this.getLicenseByKey(input.licenseKey);
    const subscription = this.getSubscription(license.subscriptionId);
    const customer = this.getCustomer(subscription.customerId);
    const plan = this.getPlan(subscription.planId);
    const devices = this.devicesByLicenseId.get(license.id) ?? [];

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
        id: subscription.id,
        status: subscription.status,
        startAt: subscription.startAt.toISOString(),
        endAt: subscription.endAt.toISOString(),
        autoRenew: subscription.autoRenew
      },
      plan: {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        maxDevices: plan.maxDevices,
        maxOfflineHours: plan.maxOfflineHours,
        features: plan.features
      },
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        document: customer.document
      },
      devices: devices.map((device) => ({
        id: device.id,
        isActive: device.isActive,
        fingerprintHash: device.fingerprintHash,
        matchSource: device.matchSource,
        lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
        createdAt: device.createdAt.toISOString()
      }))
    };
  }

  async getOperationalSummary(
    input: GetOperationalSummaryInput = {}
  ): Promise<AdminOperationalSummary> {
    const windowDays = input.windowDays ? this.normalizePositiveInteger(input.windowDays, 'window_days') : 30;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const devicesActive = Array.from(this.devicesByLicenseId.values()).reduce(
      (total, records) => total + records.filter((record) => record.isActive).length,
      0
    );

    return {
      generatedAt: now.toISOString(),
      windowDays,
      totals: {
        customers: this.customersById.size,
        subscriptionsActive: Array.from(this.subscriptionsById.values()).filter(
          (subscription) => subscription.status === 'active' && subscription.endAt > now
        ).length,
        licenses: this.licensesById.size,
        licensesActive: Array.from(this.licensesById.values()).filter(
          (license) => license.status === 'active'
        ).length,
        devicesActive
      },
      recent: {
        validationFailures: this.validationFailures.filter((date) => date >= windowStart).length,
        securityEventsCritical: this.securityCriticalEvents.filter((date) => date >= windowStart).length,
        transferEvents: this.auditLogs.filter(
          (record) => record.action === 'license_transfer' && record.createdAt >= windowStart
        ).length,
        deactivateEvents: this.auditLogs.filter(
          (record) => record.action === 'license_deactivate' && record.createdAt >= windowStart
        ).length
      }
    };
  }

  private toProgramSummary(input: ProgramRecord): AdminProgramSummary {
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

  private toPlanSummary(input: PlanRecord): AdminPlanSummary {
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

  private toCustomerSummary(input: CustomerRecord): AdminCustomerSummary {
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

  private getProgramsForPlan(planId: string): ProgramRecord[] {
    return Array.from(this.planPrograms)
      .filter((entry) => entry.startsWith(`${planId}:`))
      .map((entry) => entry.split(':')[1])
      .map((programId) => this.programs.get(programId))
      .filter((program): program is ProgramRecord => program !== undefined)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private resolveOnboardingSelection(
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

  private getOrCreateEndUser(customerId: string, identifierInput: string): EndUserRecord {
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

  private createLicense(input: {
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

  private upsertCustomer(input: {
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

  private findProgramByCode(code: string): ProgramRecord | undefined {
    const normalized = code.toLowerCase();
    return Array.from(this.programs.values()).find((program) => program.code === normalized);
  }

  private findPlanByCode(code: string): PlanRecord | undefined {
    const normalized = code.toLowerCase();
    return Array.from(this.plans.values()).find((plan) => plan.code === normalized);
  }

  private getOrCreateInternalPlanForProgram(program: ProgramRecord): PlanRecord {
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

  private getLicenseByKey(licenseKeyInput: string): LicenseRecord {
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

  private getSubscription(subscriptionId: string): SubscriptionRecord {
    const subscription = this.subscriptionsById.get(subscriptionId);
    if (!subscription) {
      this.throwDomainError(HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error', 'Subscription not found');
    }
    return subscription;
  }

  private getCustomer(customerId: string): CustomerRecord {
    const customer = this.customersById.get(customerId);
    if (!customer) {
      this.throwDomainError(HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error', 'Customer not found');
    }
    return customer;
  }

  private getPlan(planId: string): PlanRecord {
    const plan = this.plans.get(planId);
    if (!plan) {
      this.throwDomainError(HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error', 'Plan not found');
    }
    return plan;
  }

  private resolvePagination(input: {
    page?: number;
    pageSize?: number;
    query?: string;
  }): { page: number; pageSize: number; skip: number; query?: string } {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? InMemoryAdminBackofficeService.DEFAULT_PAGE_SIZE;

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

    if (pageSize > InMemoryAdminBackofficeService.MAX_PAGE_SIZE) {
      this.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        `page_size must be <= ${InMemoryAdminBackofficeService.MAX_PAGE_SIZE}`
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

  private createUniqueCode(
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

  private generateProgramCode(name: string): () => string {
    return () => {
      const slug = this.slugifyForCode(name).slice(0, 30);
      const suffix = randomBytes(2).toString('hex');
      return `${slug}-${suffix}`;
    };
  }

  private generatePlanCode(name: string): () => string {
    return () => {
      const slug = this.slugifyForCode(name).slice(0, 30);
      const suffix = randomBytes(2).toString('hex');
      return `${slug}-${suffix}`;
    };
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

  private parseDate(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      this.throwDomainError(HttpStatus.BAD_REQUEST, 'invalid_request', `${field} must be a valid ISO date`);
    }
    return parsed;
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
    return normalized.length > 0 ? normalized : null;
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

  private normalizeFeatures(features: string[]): string[] {
    return features
      .map((feature) => this.normalizeRequiredText(feature, 'features'))
      .filter((feature, index, all) => all.indexOf(feature) === index);
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

  private planProgramKey(planId: string, programId: string): string {
    return `${planId}:${programId}`;
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

  private resolveSubscriptionStatusForEdit(
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

  private resolveLicenseStatusForEdit(currentStatus: string, subscriptionStatus: string): string {
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

  private endUserKey(customerId: string, identifier: string): string {
    return `${customerId}:${identifier}`;
  }

  private throwDomainError(status: HttpStatus, code: string, detail: string): never {
    throw new DomainHttpError({
      status,
      code,
      detail
    });
  }
}
