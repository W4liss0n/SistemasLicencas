import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type {
  AdminBackofficePort,
  AdminCreateCustomerResult,
  AdminCustomerDetails,
  AdminCustomerSummary,
  AdminLicenseDetails,
  AdminOnboardCustomerResult,
  AdminOperationalSummary,
  AdminPlanSummary,
  AdminProgramSummary,
  CreateCustomerInput,
  CreatePlanInput,
  CreateProgramInput,
  GetCustomerDetailsInput,
  GetLicenseDetailsInput,
  GetOperationalSummaryInput,
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
import { PrismaAdminCatalogOperations } from './prisma/prisma-admin-catalog.operations';
import { PrismaAdminCustomersOperations } from './prisma/prisma-admin-customers.operations';
import { PrismaAdminLicensesOperations } from './prisma/prisma-admin-licenses.operations';
import { PrismaAdminOnboardingOperations } from './prisma/prisma-admin-onboarding.operations';
import { PrismaAdminOperationalSummaryReader } from './prisma/prisma-admin-operational-summary.reader';
import { PrismaAdminBackofficeSupport } from './prisma/prisma-admin-backoffice-support';

@Injectable()
export class PrismaAdminBackofficeService implements AdminBackofficePort {
  private readonly support: PrismaAdminBackofficeSupport;
  private readonly catalog: PrismaAdminCatalogOperations;
  private readonly customers: PrismaAdminCustomersOperations;
  private readonly onboarding: PrismaAdminOnboardingOperations;
  private readonly licenses: PrismaAdminLicensesOperations;
  private readonly operationalSummary: PrismaAdminOperationalSummaryReader;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.support = new PrismaAdminBackofficeSupport(prisma);
    this.catalog = new PrismaAdminCatalogOperations(prisma, this.support);
    this.customers = new PrismaAdminCustomersOperations(prisma, this.support);
    this.onboarding = new PrismaAdminOnboardingOperations(prisma, this.support);
    this.licenses = new PrismaAdminLicensesOperations(prisma, this.support);
    this.operationalSummary = new PrismaAdminOperationalSummaryReader(prisma, this.support);
  }

  createProgram(input: CreateProgramInput): Promise<AdminProgramSummary> {
    return this.catalog.createProgram(input);
  }

  listPrograms(input: ListProgramsInput): Promise<PaginatedResult<AdminProgramSummary>> {
    return this.catalog.listPrograms(input);
  }

  createPlan(input: CreatePlanInput): Promise<AdminPlanSummary> {
    return this.catalog.createPlan(input);
  }

  updatePlan(input: UpdatePlanInput): Promise<AdminPlanSummary> {
    return this.catalog.updatePlan(input);
  }

  listPlans(input: ListPlansInput): Promise<PaginatedResult<AdminPlanSummary>> {
    return this.catalog.listPlans(input);
  }

  listCustomers(input: ListCustomersInput): Promise<PaginatedResult<AdminCustomerSummary>> {
    return this.customers.listCustomers(input);
  }

  getCustomerDetails(input: GetCustomerDetailsInput): Promise<AdminCustomerDetails> {
    return this.customers.getCustomerDetails(input);
  }

  createCustomer(input: CreateCustomerInput): Promise<AdminCreateCustomerResult> {
    return this.customers.createCustomer(input);
  }

  onboardCustomer(input: OnboardCustomerInput): Promise<AdminOnboardCustomerResult> {
    return this.onboarding.onboardCustomer(input);
  }

  provisionLicense(input: ProvisionLicenseInput): Promise<AdminLicenseDetails> {
    return this.licenses.provisionLicense(input);
  }

  renewLicense(input: RenewLicenseInput): Promise<AdminLicenseDetails> {
    return this.licenses.renewLicense(input);
  }

  updateLicense(input: UpdateLicenseInput): Promise<AdminLicenseDetails> {
    return this.licenses.updateLicense(input);
  }

  blockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    return this.licenses.blockLicense(input);
  }

  unblockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    return this.licenses.unblockLicense(input);
  }

  cancelLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    return this.licenses.cancelLicense(input);
  }

  getLicenseDetails(input: GetLicenseDetailsInput): Promise<AdminLicenseDetails> {
    return this.licenses.getLicenseDetails(input);
  }

  getOperationalSummary(
    input: GetOperationalSummaryInput = {}
  ): Promise<AdminOperationalSummary> {
    return this.operationalSummary.getOperationalSummary(input);
  }
}
