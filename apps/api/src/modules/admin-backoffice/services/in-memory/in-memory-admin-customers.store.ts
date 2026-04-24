import { HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AdminCreateCustomerResult,
  AdminCustomerDetails,
  AdminCustomerSummary,
  AdminOnboardCustomerResult,
  CreateCustomerInput,
  GetCustomerDetailsInput,
  ListCustomersInput,
  OnboardCustomerInput,
  PaginatedResult
} from '../../ports/admin-backoffice.port';
import { InMemoryAdminBackofficeState, SubscriptionRecord } from './in-memory-admin-backoffice.state';

export class InMemoryAdminCustomersStore {
  constructor(private readonly state: InMemoryAdminBackofficeState) {}

  async listCustomers(input: ListCustomersInput): Promise<PaginatedResult<AdminCustomerSummary>> {
    const pagination = this.state.resolvePagination(input);
    const q = pagination.query?.toLowerCase();
    const filtered = Array.from(this.state.customersById.values())
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
      items: pageItems.map((item) => this.state.toCustomerSummary(item)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: filtered.length
    };
  }

  async getCustomerDetails(input: GetCustomerDetailsInput): Promise<AdminCustomerDetails> {
    const customerId = this.state.normalizeRequiredText(input.customerId, 'customer_id');
    const customer = this.state.customersById.get(customerId);
    if (!customer) {
      this.state.throwDomainError(HttpStatus.NOT_FOUND, 'customer_not_found', 'Customer not found');
    }
    const subscriptions = Array.from(this.state.subscriptionsById.values())
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
        const plan = this.state.getPlan(subscription.planId);
        const programs = this.state.getProgramsForPlan(plan.id).map((program) => this.state.toProgramSummary(program));
        const licenses = Array.from(this.state.licensesById.values())
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
          devices: (this.state.devicesByLicenseId.get(license.id) ?? []).map((device) => ({
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
    const customerEmail = this.state.normalizeEmail(input.customer.email);
    const customerName = this.state.normalizeRequiredText(input.customer.name, 'customer.name');
    const customerDocument = this.state.normalizeOptionalText(input.customer.document);

    const customer = this.state.upsertCustomer({
      email: customerEmail,
      name: customerName,
      document: customerDocument
    });
    const endUser = this.state.getOrCreateEndUser(customer.id, customer.email);
    this.state.auditLogs.push({ action: 'admin_customer_create', createdAt: new Date() });

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
    const customerEmail = this.state.normalizeEmail(input.customer.email);
    const customerName = this.state.normalizeRequiredText(input.customer.name, 'customer.name');
    const customerDocument = this.state.normalizeOptionalText(input.customer.document);
    const selectionMode = this.state.normalizeSelectionMode(input.selectionMode);
    const startAt = input.subscriptionStartAt
      ? this.state.parseDate(input.subscriptionStartAt, 'subscription_start_at')
      : new Date();
    const endAt = this.state.parseDate(input.subscriptionEndAt, 'subscription_end_at');

    if (endAt <= startAt) {
      this.state.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'subscription_end_at must be greater than subscription_start_at'
      );
    }

    const { plan, program } = this.state.resolveOnboardingSelection(input, selectionMode);

    const customer = this.state.upsertCustomer({
      email: customerEmail,
      name: customerName,
      document: customerDocument
    });

    const endUser = this.state.getOrCreateEndUser(customer.id, customer.email);

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
    this.state.subscriptionsById.set(subscription.id, subscription);

    const maxOfflineHours = this.state.normalizePositiveInteger(
      input.maxOfflineHours ?? plan.maxOfflineHours,
      'max_offline_hours'
    );

    const license = this.state.createLicense({
      subscriptionId: subscription.id,
      maxOfflineHours,
      programCode: program.code
    });

    this.state.auditLogs.push({ action: 'admin_customer_onboard', createdAt: now });

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
}
