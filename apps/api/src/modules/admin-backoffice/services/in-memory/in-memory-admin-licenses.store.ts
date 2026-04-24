import { HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AdminLicenseDetails,
  GetLicenseDetailsInput,
  LicenseActionInput,
  ProvisionLicenseInput,
  RenewLicenseInput,
  UpdateLicenseInput
} from '../../ports/admin-backoffice.port';
import { InMemoryAdminBackofficeState, SubscriptionRecord } from './in-memory-admin-backoffice.state';

export class InMemoryAdminLicensesStore {
  constructor(private readonly state: InMemoryAdminBackofficeState) {}

  async provisionLicense(input: ProvisionLicenseInput): Promise<AdminLicenseDetails> {
    const programCode = this.state.normalizeCode(input.programCode, 'program_code');
    const planCode = this.state.normalizeCode(input.planCode, 'plan_code');

    const program = this.state.findProgramByCode(programCode);
    if (!program || program.status !== 'active') {
      this.state.throwDomainError(HttpStatus.UNAUTHORIZED, 'unauthorized_program', 'Program is not active');
    }

    const plan = this.state.findPlanByCode(planCode);
    if (!plan) {
      this.state.throwDomainError(HttpStatus.NOT_FOUND, 'plan_not_found', 'Plan code not found');
    }

    if (!this.state.planPrograms.has(this.state.planProgramKey(plan.id, program.id))) {
      this.state.throwDomainError(
        HttpStatus.FORBIDDEN,
        'program_not_included',
        'Plan is not authorized for this program'
      );
    }

    const now = new Date();
    const startAt = input.subscription.startAt
      ? this.state.parseDate(input.subscription.startAt, 'subscription_start_at')
      : now;
    const endAt = this.state.parseDate(input.subscription.endAt, 'subscription_end_at');
    if (endAt <= startAt) {
      this.state.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'subscription_end_at must be greater than subscription_start_at'
      );
    }

    const customer = this.state.upsertCustomer({
      email: input.customer.email,
      name: input.customer.name,
      document: this.state.normalizeOptionalText(input.customer.document)
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

    this.state.auditLogs.push({
      action: 'admin_license_provision',
      createdAt: now
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async renewLicense(input: RenewLicenseInput): Promise<AdminLicenseDetails> {
    const license = this.state.getLicenseByKey(input.licenseKey);
    const subscription = this.state.getSubscription(license.subscriptionId);
    const newEndAt = this.state.parseDate(input.newEndAt, 'new_end_at');
    if (newEndAt <= new Date()) {
      this.state.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'new_end_at must be in the future'
      );
    }

    subscription.endAt = newEndAt;
    subscription.status = 'active';
    subscription.updatedAt = new Date();
    license.updatedAt = new Date();
    this.state.auditLogs.push({
      action: 'admin_license_renew',
      createdAt: new Date()
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async updateLicense(input: UpdateLicenseInput): Promise<AdminLicenseDetails> {
    const license = this.state.getLicenseByKey(input.licenseKey);
    const subscription = this.state.getSubscription(license.subscriptionId);
    const nextEndAt = this.state.parseDate(input.subscriptionEndAt, 'subscription_end_at');
    const maxOfflineHours = this.state.normalizePositiveInteger(input.maxOfflineHours, 'max_offline_hours');

    if (nextEndAt <= subscription.startAt) {
      this.state.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'subscription_end_at must be greater than subscription_start_at'
      );
    }

    const now = new Date();
    subscription.endAt = nextEndAt;
    subscription.autoRenew = input.autoRenew;
    subscription.status = this.state.resolveSubscriptionStatusForEdit(subscription.status, nextEndAt, now);
    subscription.updatedAt = now;

    license.maxOfflineHours = maxOfflineHours;
    license.status = this.state.resolveLicenseStatusForEdit(license.status, subscription.status);
    license.updatedAt = now;

    this.state.auditLogs.push({
      action: 'admin_license_update',
      createdAt: now
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async blockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    const license = this.state.getLicenseByKey(input.licenseKey);
    license.status = 'blocked';
    license.updatedAt = new Date();
    this.state.auditLogs.push({
      action: 'admin_license_block',
      createdAt: new Date()
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async unblockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    const license = this.state.getLicenseByKey(input.licenseKey);
    const subscription = this.state.getSubscription(license.subscriptionId);

    if (subscription.status !== 'active' || subscription.endAt <= new Date()) {
      this.state.throwDomainError(
        HttpStatus.FORBIDDEN,
        'subscription_expired',
        'Subscription is not eligible for unblocking'
      );
    }

    license.status = 'active';
    license.updatedAt = new Date();
    this.state.auditLogs.push({
      action: 'admin_license_unblock',
      createdAt: new Date()
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async cancelLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    const license = this.state.getLicenseByKey(input.licenseKey);
    const subscription = this.state.getSubscription(license.subscriptionId);

    license.status = 'inactive';
    license.updatedAt = new Date();
    subscription.status = 'cancelled';
    subscription.updatedAt = new Date();
    this.state.auditLogs.push({
      action: 'admin_license_cancel',
      createdAt: new Date()
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async getLicenseDetails(input: GetLicenseDetailsInput): Promise<AdminLicenseDetails> {
    const license = this.state.getLicenseByKey(input.licenseKey);
    const subscription = this.state.getSubscription(license.subscriptionId);
    const customer = this.state.getCustomer(subscription.customerId);
    const plan = this.state.getPlan(subscription.planId);
    const devices = this.state.devicesByLicenseId.get(license.id) ?? [];

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
}
