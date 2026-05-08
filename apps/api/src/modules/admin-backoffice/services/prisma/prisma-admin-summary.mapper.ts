import type { Prisma } from '@prisma/client';
import type {
  AdminCustomerSummary,
  AdminPlanSummary,
  AdminProgramSummary
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

export function toProgramSummary(input: ProgramSummaryRecord): AdminProgramSummary {
  return {
    id: input.id,
    code: input.code,
    name: input.name,
    description: input.description,
    status: input.status,
    metadata: toRecord(input.metadata),
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString()
  };
}

export function toPlanSummary(input: PlanSummaryRecord): AdminPlanSummary {
  return {
    id: input.id,
    code: input.code,
    name: input.name,
    description: input.description,
    maxDevices: input.maxDevices,
    maxOfflineHours: input.maxOfflineHours,
    features: toStringArray(input.features),
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
    programs: input.planPrograms
      .map((planProgram) => toProgramSummary(planProgram.program))
      .sort((left, right) => left.name.localeCompare(right.name))
  };
}

export function toCustomerSummary(input: CustomerSummaryRecord): AdminCustomerSummary {
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

export function toRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function toStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}
