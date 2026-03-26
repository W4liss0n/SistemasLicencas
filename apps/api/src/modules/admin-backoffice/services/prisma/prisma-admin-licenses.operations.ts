import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../../infra/prisma/prisma.service';
import type {
  AdminLicenseDetails,
  GetLicenseDetailsInput,
  LicenseActionInput,
  ProvisionLicenseInput,
  RenewLicenseInput,
  UpdateLicenseInput
} from '../../ports/admin-backoffice.port';
import { PrismaAdminBackofficeSupport } from './prisma-admin-backoffice-support';

export class PrismaAdminLicensesOperations {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: PrismaAdminBackofficeSupport
  ) {}

  async provisionLicense(input: ProvisionLicenseInput): Promise<AdminLicenseDetails> {
    const programCode = this.support.normalizeCode(input.programCode, 'program_code');
    const planCode = this.support.normalizeCode(input.planCode, 'plan_code');

    const program = await this.prisma.program.findFirst({
      where: {
        code: programCode,
        status: 'active'
      }
    });
    if (!program) {
      this.support.throwDomainError(
        HttpStatus.UNAUTHORIZED,
        'unauthorized_program',
        'Program is not active'
      );
    }

    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode }
    });
    if (!plan) {
      this.support.throwDomainError(HttpStatus.NOT_FOUND, 'plan_not_found', 'Plan code not found');
    }

    const planProgram = await this.prisma.planProgram.findFirst({
      where: {
        planId: plan.id,
        programId: program.id
      }
    });
    if (!planProgram) {
      this.support.throwDomainError(
        HttpStatus.FORBIDDEN,
        'program_not_included',
        'Plan is not authorized for this program'
      );
    }

    const now = new Date();
    const startAt = input.subscription.startAt
      ? this.support.parseDate(input.subscription.startAt, 'subscription_start_at')
      : now;
    const endAt = this.support.parseDate(input.subscription.endAt, 'subscription_end_at');
    if (endAt <= startAt) {
      this.support.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'subscription_end_at must be greater than subscription_start_at'
      );
    }

    const customerEmail = this.support.normalizeEmail(input.customer.email);
    const customerName = this.support.normalizeRequiredText(input.customer.name, 'customer.name');
    const customerDocument = this.support.normalizeOptionalText(input.customer.document);
    const maxOfflineHours = this.support.normalizePositiveInteger(
      input.maxOfflineHours !== undefined ? input.maxOfflineHours : plan.maxOfflineHours,
      'max_offline_hours'
    );

    const customer = await this.prisma.customer.upsert({
      where: { email: customerEmail },
      update: {
        name: customerName,
        document: customerDocument
      },
      create: {
        email: customerEmail,
        name: customerName,
        document: customerDocument
      }
    });

    const subscription = await this.prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: plan.id,
        status: 'active',
        startAt,
        endAt,
        autoRenew: input.subscription.autoRenew ?? false,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
      }
    });

    const license = await this.support.createLicenseWithRetry({
      subscriptionId: subscription.id,
      programCode: program.code,
      maxOfflineHours
    });

    await this.support.writeAuditLog({
      entityType: 'license',
      entityId: license.id,
      action: 'admin_license_provision',
      payload: {
        requested_by: input.requestedBy ?? 'internal-admin',
        program_code: program.code,
        plan_code: plan.code,
        customer_email: customer.email
      }
    });

    return this.getLicenseDetails({ licenseKey: license.licenseKey });
  }

  async renewLicense(input: RenewLicenseInput): Promise<AdminLicenseDetails> {
    const context = await this.support.loadLicenseContext(input.licenseKey);
    const newEndAt = this.support.parseDate(input.newEndAt, 'new_end_at');
    if (newEndAt <= new Date()) {
      this.support.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'new_end_at must be in the future'
      );
    }

    await this.prisma.subscription.update({
      where: { id: context.subscription.id },
      data: {
        status: 'active',
        endAt: newEndAt
      }
    });

    await this.support.writeAuditLog({
      entityType: 'license',
      entityId: context.license.id,
      action: 'admin_license_renew',
      payload: {
        requested_by: input.requestedBy ?? 'internal-admin',
        reason: input.reason ?? 'manual_renewal',
        new_end_at: newEndAt.toISOString()
      }
    });

    return this.getLicenseDetails({ licenseKey: input.licenseKey });
  }

  async updateLicense(input: UpdateLicenseInput): Promise<AdminLicenseDetails> {
    const context = await this.support.loadLicenseContext(input.licenseKey);
    const nextEndAt = this.support.parseDate(input.subscriptionEndAt, 'subscription_end_at');
    const maxOfflineHours = this.support.normalizePositiveInteger(
      input.maxOfflineHours,
      'max_offline_hours'
    );

    if (nextEndAt <= context.subscription.startAt) {
      this.support.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'subscription_end_at must be greater than subscription_start_at'
      );
    }

    const now = new Date();
    const subscriptionStatus = this.support.resolveSubscriptionStatusForEdit(
      context.subscription.status,
      nextEndAt,
      now
    );
    const licenseStatus = this.support.resolveLicenseStatusForEdit(
      context.license.status,
      subscriptionStatus
    );

    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: context.subscription.id },
        data: {
          endAt: nextEndAt,
          autoRenew: input.autoRenew,
          status: subscriptionStatus
        }
      }),
      this.prisma.license.update({
        where: { id: context.license.id },
        data: {
          maxOfflineHours,
          status: licenseStatus
        }
      }),
      this.prisma.auditLog.create({
        data: {
          entityType: 'license',
          entityId: context.license.id,
          action: 'admin_license_update',
          payload: {
            requested_by: input.requestedBy ?? 'internal-admin',
            subscription_end_at: nextEndAt.toISOString(),
            auto_renew: input.autoRenew,
            max_offline_hours: maxOfflineHours
          } as Prisma.InputJsonValue
        }
      })
    ]);

    return this.getLicenseDetails({ licenseKey: input.licenseKey });
  }

  async blockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    const context = await this.support.loadLicenseContext(input.licenseKey);

    await this.prisma.license.update({
      where: { id: context.license.id },
      data: { status: 'blocked' }
    });

    await this.support.writeAuditLog({
      entityType: 'license',
      entityId: context.license.id,
      action: 'admin_license_block',
      payload: {
        requested_by: input.requestedBy ?? 'internal-admin',
        reason: input.reason ?? 'manual_block'
      }
    });

    return this.getLicenseDetails({ licenseKey: input.licenseKey });
  }

  async unblockLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    const context = await this.support.loadLicenseContext(input.licenseKey);
    if (context.subscription.status !== 'active' || context.subscription.endAt <= new Date()) {
      this.support.throwDomainError(
        HttpStatus.FORBIDDEN,
        'subscription_expired',
        'Subscription is not eligible for unblocking'
      );
    }

    await this.prisma.license.update({
      where: { id: context.license.id },
      data: { status: 'active' }
    });

    await this.support.writeAuditLog({
      entityType: 'license',
      entityId: context.license.id,
      action: 'admin_license_unblock',
      payload: {
        requested_by: input.requestedBy ?? 'internal-admin',
        reason: input.reason ?? 'manual_unblock'
      }
    });

    return this.getLicenseDetails({ licenseKey: input.licenseKey });
  }

  async cancelLicense(input: LicenseActionInput): Promise<AdminLicenseDetails> {
    const context = await this.support.loadLicenseContext(input.licenseKey);

    await this.prisma.$transaction([
      this.prisma.license.update({
        where: { id: context.license.id },
        data: { status: 'inactive' }
      }),
      this.prisma.subscription.update({
        where: { id: context.subscription.id },
        data: { status: 'cancelled' }
      })
    ]);

    await this.support.writeAuditLog({
      entityType: 'license',
      entityId: context.license.id,
      action: 'admin_license_cancel',
      payload: {
        requested_by: input.requestedBy ?? 'internal-admin',
        reason: input.reason ?? 'manual_cancel'
      }
    });

    return this.getLicenseDetails({ licenseKey: input.licenseKey });
  }

  async getLicenseDetails(input: GetLicenseDetailsInput): Promise<AdminLicenseDetails> {
    const licenseKey = this.support.normalizeRequiredText(input.licenseKey, 'license_key');
    const license = await this.prisma.license.findUnique({
      where: { licenseKey },
      include: {
        subscription: {
          include: {
            plan: true,
            customer: true
          }
        },
        devices: {
          include: {
            fingerprint: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!license) {
      this.support.throwDomainError(
        HttpStatus.NOT_FOUND,
        'license_not_found',
        'License key not found'
      );
    }

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
        id: license.subscription.id,
        status: license.subscription.status,
        startAt: license.subscription.startAt.toISOString(),
        endAt: license.subscription.endAt.toISOString(),
        autoRenew: license.subscription.autoRenew
      },
      plan: {
        id: license.subscription.plan.id,
        code: license.subscription.plan.code,
        name: license.subscription.plan.name,
        maxDevices: license.subscription.plan.maxDevices,
        maxOfflineHours: license.subscription.plan.maxOfflineHours,
        features: this.support.toStringArray(license.subscription.plan.features)
      },
      customer: {
        id: license.subscription.customer.id,
        email: license.subscription.customer.email,
        name: license.subscription.customer.name,
        document: license.subscription.customer.document
      },
      devices: license.devices.map((device) => ({
        id: device.id,
        isActive: device.isActive,
        fingerprintHash: device.fingerprint.fingerprintHash,
        matchSource: device.matchSource,
        lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
        createdAt: device.createdAt.toISOString()
      }))
    };
  }
}
