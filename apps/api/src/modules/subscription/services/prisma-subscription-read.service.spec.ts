import type { PrismaService } from '../../../infra/prisma/prisma.service';
import { PrismaSubscriptionReadService } from './prisma-subscription-read.service';

describe('PrismaSubscriptionReadService', () => {
  const licenseFindUnique = jest.fn();
  const prisma = {
    license: {
      findUnique: licenseFindUnique
    }
  } as unknown as PrismaService;

  const service = new PrismaSubscriptionReadService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns license_not_found when license does not exist', async () => {
    licenseFindUnique.mockResolvedValue(null);

    const result = await service.loadEligibleLicense('LIC-UNKNOWN');

    expect(result).toEqual({
      ok: false,
      code: 'license_not_found',
      detail: 'License key not found'
    });
  });

  it('returns license_blocked when license is not active', async () => {
    licenseFindUnique.mockResolvedValue({
      id: 'license-1',
      licenseKey: 'LIC-BLOCKED',
      status: 'blocked',
      maxOfflineHours: 72,
      subscription: {
        id: 'sub-1',
        planId: 'plan-1',
        status: 'active',
        endAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      devices: []
    });

    const result = await service.loadEligibleLicense('LIC-BLOCKED');

    expect(result).toEqual({
      ok: false,
      code: 'license_blocked',
      detail: 'License is blocked'
    });
  });

  it('returns subscription_expired when subscription is inactive or expired', async () => {
    licenseFindUnique.mockResolvedValue({
      id: 'license-1',
      licenseKey: 'LIC-EXPIRED',
      status: 'active',
      maxOfflineHours: 72,
      subscription: {
        id: 'sub-1',
        planId: 'plan-1',
        status: 'expired',
        endAt: new Date(Date.now() - 60 * 1000)
      },
      devices: []
    });

    const result = await service.loadEligibleLicense('LIC-EXPIRED');

    expect(result).toEqual({
      ok: false,
      code: 'subscription_expired',
      detail: 'Subscription has expired'
    });
  });

  it('returns context for eligible license', async () => {
    const now = new Date(Date.now() + 24 * 60 * 60 * 1000);
    licenseFindUnique.mockResolvedValue({
      id: 'license-1',
      licenseKey: 'LIC-ACTIVE',
      status: 'active',
      maxOfflineHours: 72,
      subscription: {
        id: 'sub-1',
        planId: 'plan-1',
        status: 'active',
        endAt: now
      },
      devices: [
        {
          id: 'device-1',
          isActive: true,
          fingerprint: {
            fingerprintHash: 'sha256:abc'
          }
        }
      ]
    });

    const result = await service.loadEligibleLicense('LIC-ACTIVE');

    expect(result).toEqual({
      ok: true,
      context: {
        license: {
          id: 'license-1',
          licenseKey: 'LIC-ACTIVE',
          maxOfflineHours: 72
        },
        subscription: {
          id: 'sub-1',
          planId: 'plan-1',
          status: 'active',
          endAt: now
        },
        devices: [
          {
            id: 'device-1',
            isActive: true,
            fingerprintHash: 'sha256:abc'
          }
        ]
      }
    });
  });
});