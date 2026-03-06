import type { AppConfigService } from '../../../config/app-config.service';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import { EndUserAdminService } from './end-user-admin.service';

describe('EndUserAdminService', () => {
  const customerFindUnique = jest.fn();
  const endUserCreate = jest.fn();
  const endUserUpdate = jest.fn();
  const endUserSessionUpdateMany = jest.fn();

  const appConfig = {
    endUserAuthEnabled: true
  } as AppConfigService;

  const prisma = {
    customer: {
      findUnique: customerFindUnique
    },
    endUser: {
      create: endUserCreate,
      update: endUserUpdate
    },
    endUserSession: {
      updateMany: endUserSessionUpdateMany
    }
  } as unknown as PrismaService;

  const service = new EndUserAdminService(appConfig, prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    customerFindUnique.mockResolvedValue({ id: 'customer-1' });
  });

  it('creates end users under existing customers without password', async () => {
    endUserCreate.mockResolvedValue({
      id: 'user-1',
      customerId: 'customer-1',
      identifier: 'user.new@example.com',
      status: 'active',
      lastLoginAt: null,
      createdAt: new Date('2026-03-05T12:00:00.000Z'),
      updatedAt: new Date('2026-03-05T12:00:00.000Z')
    });

    const result = await service.createUser({
      customer_id: 'customer-1',
      identifier: 'USER.NEW@EXAMPLE.COM'
    });

    expect(result.success).toBe(true);
    expect(result.user.customer_id).toBe('customer-1');
    expect(result.user.identifier).toBe('user.new@example.com');
    expect(endUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'customer-1',
          identifier: 'user.new@example.com',
          passwordHash: 'oidc_disabled',
          passwordSalt: 'oidc_disabled',
          hashVersion: 'oidc_v1',
          status: 'active'
        })
      })
    );
  });

  it('revokes all active sessions when user is blocked', async () => {
    endUserUpdate.mockResolvedValue({
      id: 'user-1',
      customerId: 'customer-1',
      identifier: 'user.demo@example.com',
      status: 'blocked',
      lastLoginAt: null,
      createdAt: new Date('2026-03-05T12:00:00.000Z'),
      updatedAt: new Date('2026-03-05T12:00:00.000Z')
    });
    endUserSessionUpdateMany.mockResolvedValue({ count: 1 });

    const result = await service.blockUser('user-1');

    expect(result.success).toBe(true);
    expect(result.user.status).toBe('blocked');
    expect(endUserSessionUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        revokedAt: null
      },
      data: {
        revokedAt: expect.any(Date),
        revokeReason: 'user_blocked'
      }
    });
  });
});
