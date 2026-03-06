import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaLicenseEngineAdapter } from '../../../src/modules/license-runtime/adapters/prisma-license-engine.adapter';
import { PrismaAuditSecurityService } from '../../../src/modules/audit-security/services/prisma-audit-security.service';
import { PrismaCatalogBillingPolicyService } from '../../../src/modules/catalog-billing/services/prisma-catalog-billing-policy.service';
import { PrismaDeviceTrustService } from '../../../src/modules/device-trust/services/prisma-device-trust.service';
import { HmacOfflineEntitlementService } from '../../../src/modules/offline-entitlement/services/hmac-offline-entitlement.service';
import { PrismaSubscriptionReadService } from '../../../src/modules/subscription/services/prisma-subscription-read.service';
import type { AppConfigService } from '../../../src/config/app-config.service';
import type { PrismaService } from '../../../src/infra/prisma/prisma.service';
import type { LicenseEngineContractHarness } from '../license-engine.contract.shared';

function buildFingerprint(seed: string): Record<string, string> {
  return {
    machine_id: `${seed}-machine`,
    disk_serial: `${seed}-disk`
  };
}

function hashFingerprint(raw: Record<string, string>): string {
  const normalized = Object.entries(raw)
    .map(([key, value]) => [key.trim().toLowerCase(), String(value).trim()] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const canonical = normalized.map(([key, value]) => `${key}:${value}`).join('|');
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

type LicenseSeed = {
  licenseKey: string;
  licenseId: string;
};

export class PrismaLicenseEngineContractHarness implements LicenseEngineContractHarness {
  private readonly runId = randomUUID().replace(/-/g, '');
  private readonly runTag = this.runId.slice(0, 12);
  private readonly createdFingerprintHashes = new Set<string>();
  private readonly programCode = `contract-program-${this.runTag}`;
  private readonly customerEmail = `contract-${this.runTag}@example.com`;
  private readonly adapter: PrismaLicenseEngineAdapter;

  constructor(private readonly prisma: PrismaClient) {
    const configServiceMock = {
      jwtSecret: 'contract-test-secret-with-32-characters'
    } as AppConfigService;

    const subscriptionRead = new PrismaSubscriptionReadService(
      this.prisma as unknown as PrismaService
    );
    const catalogBillingPolicy = new PrismaCatalogBillingPolicyService(
      this.prisma as unknown as PrismaService
    );
    const deviceTrust = new PrismaDeviceTrustService(
      this.prisma as unknown as PrismaService
    );
    const auditSecurity = new PrismaAuditSecurityService(
      this.prisma as unknown as PrismaService
    );
    const offlineEntitlement = new HmacOfflineEntitlementService(configServiceMock);

    this.adapter = new PrismaLicenseEngineAdapter(
      this.prisma as unknown as PrismaService,
      subscriptionRead,
      catalogBillingPolicy,
      deviceTrust,
      auditSecurity,
      offlineEntitlement
    );
  }

  async dispose(): Promise<void> {
    const licenses = await this.prisma.license.findMany({
      where: { licenseKey: { startsWith: `LIC-CONTRACT-${this.runTag}-` } },
      select: { id: true }
    });
    const licenseIds = licenses.map((license) => license.id);

    if (licenseIds.length > 0) {
      await this.prisma.auditLog.deleteMany({
        where: {
          entityType: 'license',
          entityId: { in: licenseIds }
        }
      });

      await this.prisma.licenseDevice.deleteMany({
        where: { licenseId: { in: licenseIds } }
      });

      await this.prisma.license.deleteMany({
        where: { id: { in: licenseIds } }
      });
    }

    if (this.createdFingerprintHashes.size > 0) {
      await this.prisma.deviceFingerprint.deleteMany({
        where: {
          fingerprintHash: { in: [...this.createdFingerprintHashes] }
        }
      });
    }

    const customers = await this.prisma.customer.findMany({
      where: { email: this.customerEmail },
      select: { id: true }
    });
    const customerIds = customers.map((customer) => customer.id);

    if (customerIds.length > 0) {
      await this.prisma.subscription.deleteMany({
        where: { customerId: { in: customerIds } }
      });
      await this.prisma.customer.deleteMany({
        where: { id: { in: customerIds } }
      });
    }

    const plans = await this.prisma.plan.findMany({
      where: { code: { startsWith: `contract-plan-${this.runTag}-` } },
      select: { id: true }
    });
    const planIds = plans.map((plan) => plan.id);

    const programs = await this.prisma.program.findMany({
      where: { code: this.programCode },
      select: { id: true }
    });
    const programIds = programs.map((program) => program.id);

    if (planIds.length > 0 || programIds.length > 0) {
      const whereClauses: Array<Record<string, unknown>> = [];
      if (planIds.length > 0) {
        whereClauses.push({ planId: { in: planIds } });
      }
      if (programIds.length > 0) {
        whereClauses.push({ programId: { in: programIds } });
      }

      await this.prisma.planProgram.deleteMany({
        where: {
          OR: whereClauses
        }
      });
    }

    if (planIds.length > 0) {
      await this.prisma.plan.deleteMany({
        where: { id: { in: planIds } }
      });
    }

    if (programIds.length > 0) {
      await this.prisma.program.deleteMany({
        where: { id: { in: programIds } }
      });
    }
  }

  async validateUnknownLicense() {
    await this.ensureProgramAndCustomer();
    const raw = buildFingerprint(`unknown-${this.runId}`);
    this.trackFingerprint(raw);

    return this.adapter.validate({
      licenseKey: `LIC-CONTRACT-${this.runTag}-UNKNOWN`,
      programId: this.programCode,
      fingerprint: raw
    });
  }

  async validateBlockedLicense() {
    const { licenseKey } = await this.seedLicense({
      status: 'blocked',
      subscriptionStatus: 'active',
      endAt: this.daysFromNow(30),
      maxDevices: 1
    });
    const raw = buildFingerprint(`blocked-${this.runId}`);
    this.trackFingerprint(raw);

    return this.adapter.validate({
      licenseKey,
      programId: this.programCode,
      fingerprint: raw
    });
  }

  async validateExpiredSubscription() {
    const { licenseKey } = await this.seedLicense({
      status: 'active',
      subscriptionStatus: 'expired',
      endAt: this.daysFromNow(-1),
      maxDevices: 1
    });
    const raw = buildFingerprint(`expired-${this.runId}`);
    this.trackFingerprint(raw);

    return this.adapter.validate({
      licenseKey,
      programId: this.programCode,
      fingerprint: raw
    });
  }

  async activateFirstDevice() {
    const { licenseKey } = await this.seedLicense({
      status: 'active',
      subscriptionStatus: 'active',
      endAt: this.daysFromNow(30),
      maxDevices: 1
    });
    const raw = buildFingerprint(`activate-first-${this.runId}`);
    this.trackFingerprint(raw);

    return this.adapter.activate({
      licenseKey,
      programId: this.programCode,
      fingerprint: raw
    });
  }

  async activateSecondDeviceAfterFirst() {
    const { licenseKey } = await this.seedLicense({
      status: 'active',
      subscriptionStatus: 'active',
      endAt: this.daysFromNow(30),
      maxDevices: 1
    });

    const known = buildFingerprint(`activate-known-${this.runId}`);
    const second = buildFingerprint(`activate-second-${this.runId}`);
    this.trackFingerprint(known);
    this.trackFingerprint(second);

    await this.adapter.activate({
      licenseKey,
      programId: this.programCode,
      fingerprint: known
    });

    return this.adapter.activate({
      licenseKey,
      programId: this.programCode,
      fingerprint: second
    });
  }

  async heartbeatUnknownDevice() {
    const { licenseKey } = await this.seedLicense({
      status: 'active',
      subscriptionStatus: 'active',
      endAt: this.daysFromNow(30),
      maxDevices: 2
    });

    const known = buildFingerprint(`heartbeat-known-${this.runId}`);
    const unknown = buildFingerprint(`heartbeat-unknown-${this.runId}`);
    this.trackFingerprint(known);
    this.trackFingerprint(unknown);

    await this.adapter.activate({
      licenseKey,
      programId: this.programCode,
      fingerprint: known
    });

    return this.adapter.heartbeat({
      licenseKey,
      programId: this.programCode,
      fingerprint: unknown
    });
  }

  async transferLimitExceeded() {
    const seeded = await this.seedLicense({
      status: 'active',
      subscriptionStatus: 'active',
      endAt: this.daysFromNow(30),
      maxDevices: 2
    });

    const monthStart = this.monthStart();
    for (let index = 0; index < 3; index += 1) {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'license',
          entityId: seeded.licenseId,
          action: 'license_transfer',
          payload: { source: 'contract-test', index },
          createdAt: new Date(monthStart.getTime() + index * 60_000)
        }
      });
    }

    const raw = buildFingerprint(`transfer-limit-${this.runId}`);
    this.trackFingerprint(raw);

    return this.adapter.transfer({
      licenseKey: seeded.licenseKey,
      programId: this.programCode,
      newFingerprint: raw,
      reason: 'contract-test'
    });
  }

  async deactivateUnknownDevice() {
    const { licenseKey } = await this.seedLicense({
      status: 'active',
      subscriptionStatus: 'active',
      endAt: this.daysFromNow(30),
      maxDevices: 2
    });

    const known = buildFingerprint(`deactivate-known-${this.runId}`);
    const unknown = buildFingerprint(`deactivate-unknown-${this.runId}`);
    this.trackFingerprint(known);
    this.trackFingerprint(unknown);

    await this.adapter.activate({
      licenseKey,
      programId: this.programCode,
      fingerprint: known
    });

    return this.adapter.deactivate({
      licenseKey,
      programId: this.programCode,
      fingerprint: unknown
    });
  }

  private async ensureProgramAndCustomer(): Promise<{ programId: string; customerId: string }> {
    const program = await this.prisma.program.upsert({
      where: { code: this.programCode },
      update: {
        name: `Contract Program ${this.runId}`,
        status: 'active',
        metadata: { source: 'contract-test', run_id: this.runId }
      },
      create: {
        code: this.programCode,
        name: `Contract Program ${this.runId}`,
        status: 'active',
        metadata: { source: 'contract-test', run_id: this.runId }
      }
    });

    const customer = await this.prisma.customer.upsert({
      where: { email: this.customerEmail },
      update: { name: `Contract Customer ${this.runId}` },
      create: {
        email: this.customerEmail,
        name: `Contract Customer ${this.runId}`
      }
    });

    return { programId: program.id, customerId: customer.id };
  }

  private async seedLicense(input: {
    status: 'active' | 'blocked';
    subscriptionStatus: 'active' | 'expired';
    endAt: Date;
    maxDevices: number;
  }): Promise<LicenseSeed> {
    const { programId, customerId } = await this.ensureProgramAndCustomer();
    const suffix = randomUUID().replace(/-/g, '');
    const shortSuffix = suffix.slice(0, 12);

    const plan = await this.prisma.plan.create({
      data: {
        code: `contract-plan-${this.runTag}-${shortSuffix}`,
        name: `Contract Plan ${suffix}`,
        maxDevices: input.maxDevices,
        maxOfflineHours: 72,
        features: ['validate', 'activate', 'heartbeat', 'transfer', 'deactivate']
      }
    });

    await this.prisma.planProgram.create({
      data: {
        planId: plan.id,
        programId
      }
    });

    const subscription = await this.prisma.subscription.create({
      data: {
        customerId,
        planId: plan.id,
        status: input.subscriptionStatus,
        startAt: this.daysFromNow(-1),
        endAt: input.endAt,
        autoRenew: false,
        metadata: { source: 'contract-test' }
      }
    });

    const licenseKey = `LIC-CONTRACT-${this.runTag}-${suffix}`;
    const license = await this.prisma.license.create({
      data: {
        subscriptionId: subscription.id,
        licenseKey,
        status: input.status,
        maxOfflineHours: 72
      }
    });

    return {
      licenseKey,
      licenseId: license.id
    };
  }

  private trackFingerprint(raw: Record<string, string>): void {
    this.createdFingerprintHashes.add(hashFingerprint(raw));
  }

  private daysFromNow(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private monthStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  }
}
