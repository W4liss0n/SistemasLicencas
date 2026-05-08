import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DomainHttpError } from '../../../../common/errors/domain-http-error';
import type { OnboardCustomerInput } from '../../ports/admin-backoffice.port';

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

export async function resolveOnboardingSelection(
  tx: Prisma.TransactionClient,
  input: OnboardCustomerInput,
  selectionMode: 'plan' | 'individual_program'
): Promise<{ plan: InternalPlanRecord; program: InternalProgramRecord }> {
  if (selectionMode === 'individual_program') {
    const programId = normalizeRequiredText(input.programId ?? '', 'program_id');
    const program = await tx.program.findUnique({
      where: { id: programId }
    });
    if (!program || program.status !== 'active') {
      throwDomainError(HttpStatus.NOT_FOUND, 'program_not_found', 'Program not found');
    }

    const plan = await getOrCreateInternalPlanForProgram(tx, program);
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

  const planId = normalizeRequiredText(input.planId ?? '', 'plan_id');
  const plan = await tx.plan.findUnique({
    where: { id: planId },
    include: {
      planPrograms: {
        include: { program: true }
      }
    }
  });
  if (!plan) {
    throwDomainError(HttpStatus.NOT_FOUND, 'plan_not_found', 'Plan not found');
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
    throwDomainError(
      HttpStatus.FORBIDDEN,
      'program_not_included',
      'Plan is not authorized for this program'
    );
  }

  const programId = input.programId
    ? normalizeRequiredText(input.programId, 'program_id')
    : null;
  const selectedProgram = programId
    ? availablePrograms.find((candidate) => candidate.id === programId)
    : availablePrograms[0];

  if (!selectedProgram) {
    throwDomainError(
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
      id: selectedProgram.id,
      code: selectedProgram.code,
      name: selectedProgram.name,
      status: selectedProgram.status
    }
  };
}

async function getOrCreateInternalPlanForProgram(
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

    return toInternalPlanRecord(created);
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

  return toInternalPlanRecord(plan);
}

function toInternalPlanRecord(input: {
  id: string;
  code: string;
  name: string;
  maxDevices: number;
  maxOfflineHours: number;
  features: Prisma.JsonValue;
}): InternalPlanRecord {
  return {
    id: input.id,
    code: input.code,
    name: input.name,
    maxDevices: input.maxDevices,
    maxOfflineHours: input.maxOfflineHours,
    features: input.features
  };
}

function normalizeRequiredText(value: string, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throwDomainError(HttpStatus.BAD_REQUEST, 'invalid_request', `${field} is required`);
  }

  return normalized;
}

function throwDomainError(status: HttpStatus, code: string, detail: string): never {
  throw new DomainHttpError({
    status,
    code,
    detail
  });
}
