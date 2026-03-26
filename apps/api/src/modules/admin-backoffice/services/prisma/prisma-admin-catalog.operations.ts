import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../../infra/prisma/prisma.service';
import type {
  AdminPlanSummary,
  AdminProgramSummary,
  CreatePlanInput,
  CreateProgramInput,
  ListPlansInput,
  ListProgramsInput,
  PaginatedResult,
  UpdatePlanInput
} from '../../ports/admin-backoffice.port';
import { PrismaAdminBackofficeSupport } from './prisma-admin-backoffice-support';

export class PrismaAdminCatalogOperations {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: PrismaAdminBackofficeSupport
  ) {}

  async createProgram(input: CreateProgramInput): Promise<AdminProgramSummary> {
    const name = this.support.normalizeRequiredText(input.name, 'name');
    const description = this.support.normalizeOptionalText(input.description);
    const metadata = this.support.normalizeMetadata(input.metadata);
    const requestedBy = this.support.normalizeOptionalText(input.requestedBy) ?? 'internal-admin';

    const created = await this.support.createProgramWithRetry({
      name,
      description,
      metadata
    });

    await this.support.writeAuditLog({
      entityType: 'program',
      entityId: created.id,
      action: 'admin_program_create',
      payload: {
        requested_by: requestedBy,
        program_id: created.id,
        program_code: created.code
      }
    });

    return this.support.toProgramSummary(created);
  }

  async listPrograms(input: ListProgramsInput): Promise<PaginatedResult<AdminProgramSummary>> {
    const pagination = this.support.resolvePagination(input);
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
      items: items.map((item) => this.support.toProgramSummary(item)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total
    };
  }

  async createPlan(input: CreatePlanInput): Promise<AdminPlanSummary> {
    const name = this.support.normalizeRequiredText(input.name, 'name');
    const description = this.support.normalizeOptionalText(input.description);
    const requestedBy = this.support.normalizeOptionalText(input.requestedBy) ?? 'internal-admin';
    const maxDevices = this.support.normalizePositiveInteger(input.maxDevices, 'max_devices');
    const maxOfflineHours = this.support.normalizePositiveInteger(
      input.maxOfflineHours,
      'max_offline_hours'
    );
    const features = this.support.normalizeFeatures(input.features);
    const programIds = this.normalizeProgramIds(input.programIds);

    const programs = await this.prisma.program.findMany({
      where: {
        id: {
          in: programIds
        }
      },
      select: { id: true }
    });

    if (programs.length !== programIds.length) {
      this.support.throwDomainError(
        HttpStatus.NOT_FOUND,
        'program_not_found',
        'One or more programs were not found'
      );
    }

    const created = await this.support.createPlanWithRetry({
      name,
      description,
      maxDevices,
      maxOfflineHours,
      features,
      programIds
    });

    await this.support.writeAuditLog({
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

    return this.support.toPlanSummary(created);
  }

  async updatePlan(input: UpdatePlanInput): Promise<AdminPlanSummary> {
    const planId = this.support.normalizeRequiredText(input.planId, 'plan_id');
    const name = this.support.normalizeRequiredText(input.name, 'name');
    const description = this.support.normalizeOptionalText(input.description);
    const requestedBy = this.support.normalizeOptionalText(input.requestedBy) ?? 'internal-admin';
    const maxDevices = this.support.normalizePositiveInteger(input.maxDevices, 'max_devices');
    const maxOfflineHours = this.support.normalizePositiveInteger(
      input.maxOfflineHours,
      'max_offline_hours'
    );
    const features = this.support.normalizeFeatures(input.features);
    const programIds = this.normalizeProgramIds(input.programIds);

    const programs = await this.prisma.program.findMany({
      where: {
        id: {
          in: programIds
        }
      },
      select: { id: true }
    });

    if (programs.length !== programIds.length) {
      this.support.throwDomainError(
        HttpStatus.NOT_FOUND,
        'program_not_found',
        'One or more programs were not found'
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.plan.findUnique({
        where: { id: planId },
        include: {
          planPrograms: {
            include: { program: true }
          }
        }
      });

      if (!existing || existing.isInternal) {
        this.support.throwDomainError(HttpStatus.NOT_FOUND, 'plan_not_found', 'Plan not found');
      }

      await tx.plan.update({
        where: { id: planId },
        data: {
          name,
          description,
          maxDevices,
          maxOfflineHours,
          features: features as Prisma.InputJsonValue
        }
      });

      await tx.planProgram.deleteMany({
        where: { planId }
      });

      await tx.planProgram.createMany({
        data: programIds.map((programId) => ({
          planId,
          programId
        }))
      });

      await tx.auditLog.create({
        data: {
          entityType: 'plan',
          entityId: planId,
          action: 'admin_plan_update',
          payload: {
            requested_by: requestedBy,
            plan_id: planId,
            program_ids: programIds
          } as Prisma.InputJsonValue
        }
      });

      return tx.plan.findUniqueOrThrow({
        where: { id: planId },
        include: {
          planPrograms: {
            include: { program: true }
          }
        }
      });
    });

    return this.support.toPlanSummary(updated);
  }

  async listPlans(input: ListPlansInput): Promise<PaginatedResult<AdminPlanSummary>> {
    const pagination = this.support.resolvePagination(input);
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
      items: items.map((item) => this.support.toPlanSummary(item)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total
    };
  }

  private normalizeProgramIds(programIds: string[]): string[] {
    const normalized = Array.from(
      new Set(
        programIds
          .map((programId) => this.support.normalizeRequiredText(programId, 'program_ids'))
          .filter((programId) => programId.length > 0)
      )
    );

    if (normalized.length === 0) {
      this.support.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'program_ids must include at least one program'
      );
    }

    return normalized;
  }
}
