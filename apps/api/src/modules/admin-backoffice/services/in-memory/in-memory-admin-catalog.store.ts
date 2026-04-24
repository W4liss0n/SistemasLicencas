import { HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AdminPlanSummary,
  AdminProgramSummary,
  CreatePlanInput,
  CreateProgramInput,
  ListPlansInput,
  ListProgramsInput,
  PaginatedResult,
  UpdatePlanInput
} from '../../ports/admin-backoffice.port';
import { InMemoryAdminBackofficeState, PlanRecord, ProgramRecord } from './in-memory-admin-backoffice.state';

export class InMemoryAdminCatalogStore {
  constructor(private readonly state: InMemoryAdminBackofficeState) {}

  async createProgram(input: CreateProgramInput): Promise<AdminProgramSummary> {
    const name = this.state.normalizeRequiredText(input.name, 'name');
    const description = this.state.normalizeOptionalText(input.description);
    const metadata = this.state.normalizeMetadata(input.metadata);
    const code = this.state.createUniqueCode(
      (candidate) => Array.from(this.state.programs.values()).some((program) => program.code === candidate),
      this.state.generateProgramCode(name)
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

    this.state.programs.set(program.id, program);
    this.state.auditLogs.push({ action: 'admin_program_create', createdAt: now });

    return this.state.toProgramSummary(program);
  }

  async listPrograms(input: ListProgramsInput): Promise<PaginatedResult<AdminProgramSummary>> {
    const pagination = this.state.resolvePagination(input);
    const q = pagination.query?.toLowerCase();
    const filtered = Array.from(this.state.programs.values())
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
      items: pageItems.map((item) => this.state.toProgramSummary(item)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: filtered.length
    };
  }

  async createPlan(input: CreatePlanInput): Promise<AdminPlanSummary> {
    const name = this.state.normalizeRequiredText(input.name, 'name');
    const description = this.state.normalizeOptionalText(input.description);
    const maxDevices = this.state.normalizePositiveInteger(input.maxDevices, 'max_devices');
    const maxOfflineHours = this.state.normalizePositiveInteger(input.maxOfflineHours, 'max_offline_hours');
    const features = this.state.normalizeFeatures(input.features);
    const programIds = Array.from(
      new Set(
        input.programIds
          .map((programId) => this.state.normalizeRequiredText(programId, 'program_ids'))
          .filter((programId) => programId.length > 0)
      )
    );

    if (programIds.length === 0) {
      this.state.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'program_ids must include at least one program'
      );
    }

    for (const programId of programIds) {
      const program = this.state.programs.get(programId);
      if (!program) {
        this.state.throwDomainError(HttpStatus.NOT_FOUND, 'program_not_found', 'Program not found');
      }
    }

    const code = this.state.createUniqueCode(
      (candidate) => Array.from(this.state.plans.values()).some((plan) => plan.code === candidate),
      this.state.generatePlanCode(name)
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

    this.state.plans.set(plan.id, plan);
    for (const programId of programIds) {
      this.state.planPrograms.add(this.state.planProgramKey(plan.id, programId));
    }
    this.state.auditLogs.push({ action: 'admin_plan_create', createdAt: now });

    return this.state.toPlanSummary(plan);
  }

  async updatePlan(input: UpdatePlanInput): Promise<AdminPlanSummary> {
    const planId = this.state.normalizeRequiredText(input.planId, 'plan_id');
    const plan = this.state.plans.get(planId);
    if (!plan || plan.isInternal) {
      this.state.throwDomainError(HttpStatus.NOT_FOUND, 'plan_not_found', 'Plan not found');
    }

    const name = this.state.normalizeRequiredText(input.name, 'name');
    const description = this.state.normalizeOptionalText(input.description);
    const maxDevices = this.state.normalizePositiveInteger(input.maxDevices, 'max_devices');
    const maxOfflineHours = this.state.normalizePositiveInteger(input.maxOfflineHours, 'max_offline_hours');
    const features = this.state.normalizeFeatures(input.features);
    const programIds = Array.from(
      new Set(
        input.programIds
          .map((programId) => this.state.normalizeRequiredText(programId, 'program_ids'))
          .filter((programId) => programId.length > 0)
      )
    );

    if (programIds.length === 0) {
      this.state.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'program_ids must include at least one program'
      );
    }

    for (const programId of programIds) {
      const program = this.state.programs.get(programId);
      if (!program) {
        this.state.throwDomainError(HttpStatus.NOT_FOUND, 'program_not_found', 'Program not found');
      }
    }

    plan.name = name;
    plan.description = description;
    plan.maxDevices = maxDevices;
    plan.maxOfflineHours = maxOfflineHours;
    plan.features = features;
    plan.updatedAt = new Date();

    for (const link of Array.from(this.state.planPrograms)) {
      if (link.startsWith(`${plan.id}:`)) {
        this.state.planPrograms.delete(link);
      }
    }

    for (const programId of programIds) {
      this.state.planPrograms.add(this.state.planProgramKey(plan.id, programId));
    }

    this.state.auditLogs.push({ action: 'admin_plan_update', createdAt: new Date() });

    return this.state.toPlanSummary(plan);
  }

  async listPlans(input: ListPlansInput): Promise<PaginatedResult<AdminPlanSummary>> {
    const pagination = this.state.resolvePagination(input);
    const q = pagination.query?.toLowerCase();
    const filtered = Array.from(this.state.plans.values())
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
      items: pageItems.map((item) => this.state.toPlanSummary(item)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: filtered.length
    };
  }
}
