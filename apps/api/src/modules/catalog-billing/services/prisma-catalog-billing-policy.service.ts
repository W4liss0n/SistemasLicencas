import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  CatalogBillingFailure,
  CatalogBillingPolicyPort,
  ResolveAuthorizedProgramResult,
  ResolveProgramPolicyInput,
  ResolveProgramPolicyResult,
  normalizeProgramContext
} from '../ports/catalog-billing-policy.port';

@Injectable()
export class PrismaCatalogBillingPolicyService implements CatalogBillingPolicyPort {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async resolveAuthorizedProgram(programId: string): Promise<ResolveAuthorizedProgramResult> {
    const program = await this.prisma.program.findFirst({
      where: this.isUuid(programId)
        ? { id: programId, status: 'active' }
        : { code: programId, status: 'active' },
      select: {
        id: true,
        code: true
      }
    });

    if (!program) {
      return this.failure('unauthorized_program', 'Program is not authorized');
    }

    return {
      ok: true,
      program: normalizeProgramContext(program)
    };
  }

  async resolveProgramPolicy(input: ResolveProgramPolicyInput): Promise<ResolveProgramPolicyResult> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: input.planId },
      select: {
        id: true,
        name: true,
        maxDevices: true,
        features: true,
        planPrograms: {
          where: {
            programId: input.programId
          },
          select: {
            id: true
          }
        }
      }
    });

    if (!plan || plan.planPrograms.length === 0) {
      return this.failure('program_not_included', 'Program not included in subscription plan');
    }

    return {
      ok: true,
      policy: {
        planId: plan.id,
        planName: plan.name,
        maxDevices: plan.maxDevices,
        features: this.normalizeFeatures(plan.features)
      }
    };
  }

  private normalizeFeatures(features: Prisma.JsonValue): string[] {
    if (!Array.isArray(features)) {
      return [];
    }

    return features.map((value) => String(value));
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }

  private failure(code: CatalogBillingFailure['code'], detail: string): CatalogBillingFailure {
    return { ok: false, code, detail };
  }
}