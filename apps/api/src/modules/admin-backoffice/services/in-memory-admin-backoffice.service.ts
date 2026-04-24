import { Injectable } from '@nestjs/common';
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
import { InMemoryAdminBackofficeState } from './in-memory/in-memory-admin-backoffice.state';
import { InMemoryAdminCatalogStore } from './in-memory/in-memory-admin-catalog.store';
import { InMemoryAdminCustomersStore } from './in-memory/in-memory-admin-customers.store';
import { InMemoryAdminLicensesStore } from './in-memory/in-memory-admin-licenses.store';
import { InMemoryAdminOperationalSummaryStore } from './in-memory/in-memory-admin-operational-summary.store';

@Injectable()
export class InMemoryAdminBackofficeService implements AdminBackofficePort {
  private readonly state = new InMemoryAdminBackofficeState();
  private readonly catalog = new InMemoryAdminCatalogStore(this.state);
  private readonly customers = new InMemoryAdminCustomersStore(this.state);
  private readonly licenses = new InMemoryAdminLicensesStore(this.state);
  private readonly operationalSummary = new InMemoryAdminOperationalSummaryStore(this.state);

  async createProgram(input: CreateProgramInput): Promise<AdminProgramSummary> {
    return this.catalog.createProgram(input);
  }

  async listPrograms(input: ListProgramsInput): Promise<PaginatedResult<AdminProgramSummary>> {
    return this.catalog.listPrograms(input);
  }

  async createPlan(input: CreatePlanInput): Promise<AdminPlanSummary> {
    return this.catalog.createPlan(input);
  }

  async updatePlan(input: UpdatePlanInput): Promise<AdminPlanSummary> {
    return this.catalog.updatePlan(input);
  }

  async listPlans(input: ListPlansInput): Promise<PaginatedResult<AdminPlanSummary>> {
    return this.catalog.listPlans(input);
  }

  async listCustomers(input: ListCustomersInput): Promise<PaginatedResult<AdminCustomerSummary>> {
    return this.customers.listCustomers(input);
  }

  async getCustomerDetails(input: GetCustomerDetailsInput): Promise<AdminCustomerDetails> {
    return this.customers.getCustomerDetails(input);
  }

  async createCustomer(input: CreateCustomerInput): Promise<AdminCreateCustomerResult> {
    return this.customers.createCustomer(input);
  }

  async onboardCustomer(input: OnboardCustomerInput): Promise<AdminOnboardCustomerResult> {
    return this.customers.onboardCustomer(input);
  }

  async provisionLicense(input: ProvisionLicenseInput): Promise<AdminLicenseDetails> {
    return this.licenses.provisionLicense(input);
  }

  async renewLicense(input: RenewLicenseInput): Promise<AdminLicenseDetails> {
    return this.licenses.renewLicense(input);
  }

  async updateLicense(input: UpdateLicenseInput): Promise<AdminLicenseDetails> {
    return this.licenses.updateLicense(input);
  }

  async blockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    return this.licenses.blockLicense(input);
  }

  async unblockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    return this.licenses.unblockLicense(input);
  }

  async cancelLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    return this.licenses.cancelLicense(input);
  }

  async getLicenseDetails(input: GetLicenseDetailsInput): Promise<AdminLicenseDetails> {
    return this.licenses.getLicenseDetails(input);
  }

  async getOperationalSummary(
    input: GetOperationalSummaryInput = {}
  ): Promise<AdminOperationalSummary> {
    return this.operationalSummary.getOperationalSummary(input);
  }
}
