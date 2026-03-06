import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  SubscriptionLicenseContext,
  SubscriptionReadFailure,
  SubscriptionReadPort,
  SubscriptionReadResult
} from '../ports/subscription-read.port';

@Injectable()
export class PrismaSubscriptionReadService implements SubscriptionReadPort {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async loadEligibleLicense(licenseKey: string): Promise<SubscriptionReadResult> {
    const license = await this.prisma.license.findUnique({
      where: { licenseKey },
      include: {
        subscription: true,
        devices: {
          include: {
            fingerprint: true
          }
        }
      }
    });

    if (!license) {
      return this.failure('license_not_found', 'License key not found');
    }

    if (license.status !== 'active') {
      return this.failure('license_blocked', 'License is blocked');
    }

    const now = new Date();
    if (license.subscription.status !== 'active' || license.subscription.endAt <= now) {
      return this.failure('subscription_expired', 'Subscription has expired');
    }

    const context: SubscriptionLicenseContext = {
      license: {
        id: license.id,
        licenseKey: license.licenseKey,
        maxOfflineHours: license.maxOfflineHours
      },
      subscription: {
        id: license.subscription.id,
        planId: license.subscription.planId,
        status: license.subscription.status,
        endAt: license.subscription.endAt
      },
      devices: license.devices.map((device) => ({
        id: device.id,
        isActive: device.isActive,
        fingerprintHash: device.fingerprint.fingerprintHash
      }))
    };

    return {
      ok: true,
      context
    };
  }

  private failure(code: SubscriptionReadFailure['code'], detail: string): SubscriptionReadFailure {
    return { ok: false, code, detail };
  }
}