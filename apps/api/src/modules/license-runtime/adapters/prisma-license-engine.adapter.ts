import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  AUDIT_SECURITY_PORT,
  AuditSecurityPort
} from '../../audit-security/ports/audit-security.port';
import {
  CATALOG_BILLING_POLICY_PORT,
  CatalogBillingPolicyPort
} from '../../catalog-billing/ports/catalog-billing-policy.port';
import {
  DEVICE_TRUST_PORT,
  DeviceTrustPort
} from '../../device-trust/ports/device-trust.port';
import {
  OFFLINE_ENTITLEMENT_PORT,
  OfflineEntitlementPort
} from '../../offline-entitlement/ports/offline-entitlement.port';
import {
  SUBSCRIPTION_READ_PORT,
  SubscriptionReadPort
} from '../../subscription/ports/subscription-read.port';
import {
  ActivateLicenseInput,
  ActivateLicenseResult,
  DeactivateLicenseInput,
  DeactivateLicenseResult,
  HeartbeatInput,
  HeartbeatResult,
  LicenseEngineFailure,
  LicenseEngineLicenseInfo,
  LicenseEnginePort,
  TransferLicenseInput,
  TransferLicenseResult,
  ValidateLicenseInput,
  ValidateLicenseResult
} from '../ports/license-engine.port';

type LicenseExecutionContext = {
  license: {
    id: string;
    licenseKey: string;
    maxOfflineHours: number;
  };
  subscription: {
    id: string;
    planId: string;
    endAt: Date;
  };
  devices: Array<{
    id: string;
    isActive: boolean;
    fingerprintHash: string;
  }>;
  policy: {
    planId: string;
    planName: string;
    maxDevices: number;
    features: string[];
  };
  program: {
    id: string;
    code: string;
  };
};

@Injectable()
export class PrismaLicenseEngineAdapter implements LicenseEnginePort {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SUBSCRIPTION_READ_PORT)
    private readonly subscriptionRead: SubscriptionReadPort,
    @Inject(CATALOG_BILLING_POLICY_PORT)
    private readonly catalogBillingPolicy: CatalogBillingPolicyPort,
    @Inject(DEVICE_TRUST_PORT)
    private readonly deviceTrust: DeviceTrustPort,
    @Inject(AUDIT_SECURITY_PORT)
    private readonly auditSecurity: AuditSecurityPort,
    @Inject(OFFLINE_ENTITLEMENT_PORT)
    private readonly offlineEntitlement: OfflineEntitlementPort
  ) {}

  async validate(input: ValidateLicenseInput): Promise<ValidateLicenseResult> {
    const context = await this.loadExecutionContext(input.licenseKey, input.programId);
    if (this.isFailure(context)) {
      return context;
    }

    const parsed = this.deviceTrust.parseFingerprint(input.fingerprint);
    if (!parsed.ok) {
      return this.failure(parsed.code, parsed.detail);
    }
    const fingerprint = parsed.parsed;

    const activeDevices = context.devices.filter((device) => device.isActive);
    const matchedDevice = activeDevices.find(
      (device) => device.fingerprintHash === fingerprint.fingerprintHash
    );

    if (activeDevices.length > 0 && !matchedDevice) {
      return this.failure('fingerprint_mismatch', 'Device fingerprint mismatch');
    }

    if (!matchedDevice && activeDevices.length === 0) {
      await this.deviceTrust.registerDevice({
        licenseId: context.license.id,
        fingerprintHash: fingerprint.fingerprintHash,
        rawComponents: fingerprint.rawComponents,
        matchSource: 'validate'
      });
    }

    if (matchedDevice) {
      await this.deviceTrust.touchDevice({
        licenseDeviceId: matchedDevice.id,
        matchSource: 'validate'
      });
    }

    return {
      ok: true,
      licenseInfo: this.buildLicenseInfo(context),
      offlineToken: this.offlineEntitlement.issueOfflineToken({
        licenseKey: context.license.licenseKey,
        fingerprintHash: fingerprint.fingerprintHash
      }),
      security: {
        riskScore: 0.1,
        warnings: [],
        nextHeartbeat: 3600
      }
    };
  }

  async activate(input: ActivateLicenseInput): Promise<ActivateLicenseResult> {
    const context = await this.loadExecutionContext(input.licenseKey, input.programId);
    if (this.isFailure(context)) {
      return context;
    }

    const parsed = this.deviceTrust.parseFingerprint(input.fingerprint);
    if (!parsed.ok) {
      return this.failure(parsed.code, parsed.detail);
    }
    const fingerprint = parsed.parsed;

    const activeDevices = context.devices.filter((device) => device.isActive);
    const matchedDevice = activeDevices.find(
      (device) => device.fingerprintHash === fingerprint.fingerprintHash
    );

    if (!matchedDevice && activeDevices.length >= context.policy.maxDevices) {
      return this.failure(
        'max_devices_reached',
        `Maximum number of active devices reached (${context.policy.maxDevices})`
      );
    }

    if (!matchedDevice) {
      await this.deviceTrust.registerDevice({
        licenseId: context.license.id,
        fingerprintHash: fingerprint.fingerprintHash,
        rawComponents: fingerprint.rawComponents,
        matchSource: 'activate'
      });
    } else {
      await this.deviceTrust.touchDevice({
        licenseDeviceId: matchedDevice.id,
        matchSource: 'activate'
      });
    }

    return {
      ok: true,
      licenseInfo: this.buildLicenseInfo(context),
      offlineToken: this.offlineEntitlement.issueOfflineToken({
        licenseKey: context.license.licenseKey,
        fingerprintHash: fingerprint.fingerprintHash
      }),
      security: {
        riskScore: 0.1,
        warnings: [],
        nextHeartbeat: 3600
      }
    };
  }

  async heartbeat(input: HeartbeatInput): Promise<HeartbeatResult> {
    const context = await this.loadExecutionContext(input.licenseKey, input.programId);
    if (this.isFailure(context)) {
      return context;
    }

    const parsed = this.deviceTrust.parseFingerprint(input.fingerprint);
    if (!parsed.ok) {
      return this.failure(parsed.code, parsed.detail);
    }
    const fingerprint = parsed.parsed;

    const activeDevices = context.devices.filter((device) => device.isActive);
    const matchedDevice = activeDevices.find(
      (device) => device.fingerprintHash === fingerprint.fingerprintHash
    );

    if (!matchedDevice) {
      return this.failure('fingerprint_mismatch', 'Device fingerprint mismatch');
    }

    await this.deviceTrust.touchDevice({
      licenseDeviceId: matchedDevice.id,
      matchSource: 'heartbeat'
    });

    return {
      ok: true,
      nextHeartbeat: 3600,
      serverTime: Date.now()
    };
  }

  async transfer(input: TransferLicenseInput): Promise<TransferLicenseResult> {
    const context = await this.loadExecutionContext(input.licenseKey, input.programId);
    if (this.isFailure(context)) {
      return context;
    }

    const parsed = this.deviceTrust.parseFingerprint(input.newFingerprint);
    if (!parsed.ok) {
      return this.failure(parsed.code, parsed.detail);
    }
    const fingerprint = parsed.parsed;

    const monthStart = this.getCurrentMonthStart();
    const monthTransfers = await this.auditSecurity.countAuditLogsSince({
      entityType: 'license',
      entityId: context.license.id,
      action: 'license_transfer',
      since: monthStart
    });

    if (monthTransfers >= 3) {
      return this.failure('transfer_limit_exceeded', 'Monthly transfer limit reached (3/month)');
    }

    await this.deviceTrust.replaceActiveDevice({
      licenseId: context.license.id,
      fingerprintHash: fingerprint.fingerprintHash,
      rawComponents: fingerprint.rawComponents,
      matchSource: 'transfer'
    });

    await this.prisma.license.update({
      where: { id: context.license.id },
      data: {
        transferCount: { increment: 1 },
        lastTransferAt: new Date()
      }
    });

    await this.auditSecurity.writeAuditLog({
      entityType: 'license',
      entityId: context.license.id,
      action: 'license_transfer',
      payload: {
        reason: input.reason ?? 'device_replacement',
        program_id: input.programId,
        fingerprint_hash: fingerprint.fingerprintHash
      }
    });

    return {
      ok: true,
      transferCountMonth: monthTransfers + 1,
      message: 'License transferred successfully'
    };
  }

  async deactivate(input: DeactivateLicenseInput): Promise<DeactivateLicenseResult> {
    const context = await this.loadExecutionContext(input.licenseKey, input.programId);
    if (this.isFailure(context)) {
      return context;
    }

    const parsed = this.deviceTrust.parseFingerprint(input.fingerprint);
    if (!parsed.ok) {
      return this.failure(parsed.code, parsed.detail);
    }
    const fingerprint = parsed.parsed;

    const activeDevices = context.devices.filter((device) => device.isActive);
    const matchedDevice = activeDevices.find(
      (device) => device.fingerprintHash === fingerprint.fingerprintHash
    );

    if (!matchedDevice) {
      return this.failure('fingerprint_mismatch', 'Device fingerprint mismatch');
    }

    await this.deviceTrust.deactivateDevice({
      licenseDeviceId: matchedDevice.id,
      matchSource: 'deactivate'
    });

    await this.auditSecurity.writeAuditLog({
      entityType: 'license',
      entityId: context.license.id,
      action: 'license_deactivate',
      payload: {
        program_id: input.programId,
        fingerprint_hash: fingerprint.fingerprintHash
      }
    });

    return {
      ok: true,
      message: 'Device deactivated successfully'
    };
  }

  private async loadExecutionContext(
    licenseKey: string,
    programId: string
  ): Promise<LicenseExecutionContext | LicenseEngineFailure> {
    const programResult = await this.catalogBillingPolicy.resolveAuthorizedProgram(programId);
    if (!programResult.ok) {
      return this.failure(programResult.code, programResult.detail);
    }

    const subscriptionResult = await this.subscriptionRead.loadEligibleLicense(licenseKey);
    if (!subscriptionResult.ok) {
      return this.failure(subscriptionResult.code, subscriptionResult.detail);
    }

    const policyResult = await this.catalogBillingPolicy.resolveProgramPolicy({
      programId: programResult.program.id,
      planId: subscriptionResult.context.subscription.planId
    });
    if (!policyResult.ok) {
      return this.failure(policyResult.code, policyResult.detail);
    }

    return {
      license: subscriptionResult.context.license,
      subscription: subscriptionResult.context.subscription,
      devices: subscriptionResult.context.devices,
      policy: policyResult.policy,
      program: programResult.program
    };
  }

  private buildLicenseInfo(context: LicenseExecutionContext): LicenseEngineLicenseInfo {
    return {
      licenseKey: context.license.licenseKey,
      expiration: context.subscription.endAt.toISOString(),
      planName: context.policy.planName,
      maxOfflineHours: context.license.maxOfflineHours,
      features: context.policy.features
    };
  }

  private getCurrentMonthStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  private failure(code: LicenseEngineFailure['code'], detail: string): LicenseEngineFailure {
    return { ok: false, code, detail };
  }

  private isFailure(value: LicenseExecutionContext | LicenseEngineFailure): value is LicenseEngineFailure {
    return (value as LicenseEngineFailure).ok === false;
  }
}
