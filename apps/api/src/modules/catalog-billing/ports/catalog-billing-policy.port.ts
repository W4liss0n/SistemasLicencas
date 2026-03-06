import type { Program } from '@prisma/client';

export type CatalogBillingFailureCode = 'unauthorized_program' | 'program_not_included';

export interface CatalogBillingFailure {
  ok: false;
  code: CatalogBillingFailureCode;
  detail: string;
}

export interface AuthorizedProgramContext {
  id: string;
  code: string;
}

export interface ProgramPolicy {
  planId: string;
  planName: string;
  maxDevices: number;
  features: string[];
}

export interface ResolveAuthorizedProgramSuccess {
  ok: true;
  program: AuthorizedProgramContext;
}

export interface ResolveProgramPolicySuccess {
  ok: true;
  policy: ProgramPolicy;
}

export type ResolveAuthorizedProgramResult =
  | ResolveAuthorizedProgramSuccess
  | CatalogBillingFailure;

export type ResolveProgramPolicyResult =
  | ResolveProgramPolicySuccess
  | CatalogBillingFailure;

export interface ResolveProgramPolicyInput {
  programId: string;
  planId: string;
}

export const CATALOG_BILLING_POLICY_PORT = Symbol('CATALOG_BILLING_POLICY_PORT');

export interface CatalogBillingPolicyPort {
  resolveAuthorizedProgram(programId: string): Promise<ResolveAuthorizedProgramResult>;
  resolveProgramPolicy(input: ResolveProgramPolicyInput): Promise<ResolveProgramPolicyResult>;
}

export function normalizeProgramContext(program: Pick<Program, 'id' | 'code'>): AuthorizedProgramContext {
  return {
    id: program.id,
    code: program.code
  };
}