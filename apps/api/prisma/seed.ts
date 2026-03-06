import { PrismaClient } from '@prisma/client';
import { scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

const IDS = {
  planBasic: '11111111-1111-4111-8111-111111111111',
  planPro: '22222222-2222-4222-8222-222222222222',
  programDemo: '33333333-3333-4333-8333-333333333333',
  programExtra: '31333333-3333-4333-8333-333333333333',
  credentialDemo: '34333333-3333-4333-8333-333333333333',
  customerDemo: '44444444-4444-4444-8444-444444444444',
  endUserDemo: '41444444-4444-4444-8444-444444444444',
  endUserBlocked: '42444444-4444-4444-8444-444444444444',
  subscriptionActive: '55555555-5555-4555-8555-555555555555',
  subscriptionExpired: '66666666-6666-4666-8666-666666666666',
  licenseActive: '77777777-7777-4777-8777-777777777777',
  licenseBlocked: '88888888-8888-4888-8888-888888888888',
  licenseExpired: '99999999-9999-4999-8999-999999999999',
  licenseTransferLimit: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  planProgramBasicDemo: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  planProgramProDemo: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  auditTransfer1: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  auditTransfer2: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  auditTransfer3: 'ffffffff-ffff-4fff-8fff-ffffffffffff'
} as const;

const DEMO_IDENTIFIER = 'demo@example.com';
const DEMO_PASSWORD = 'demo123';
const DEMO_SALT = 'seeded-demo-credential-salt';
const END_USER_IDENTIFIER = 'user.demo@example.com';
const END_USER_PASSWORD = 'user-demo-123';
const END_USER_SALT = 'seeded-end-user-salt';
const BLOCKED_USER_IDENTIFIER = 'user.blocked@example.com';
const BLOCKED_USER_PASSWORD = 'user-blocked-123';
const BLOCKED_USER_SALT = 'seeded-blocked-user-salt';

async function seed(): Promise<void> {
  const authPepper = process.env.AUTH_PASSWORD_PEPPER ?? 'change-me-auth-pepper-please';
  const demoPasswordHash = scryptSync(`${DEMO_PASSWORD}:${authPepper}`, DEMO_SALT, 64).toString(
    'base64'
  );
  const endUserPasswordHash = scryptSync(
    `${END_USER_PASSWORD}:${authPepper}`,
    END_USER_SALT,
    64
  ).toString('base64');
  const blockedUserPasswordHash = scryptSync(
    `${BLOCKED_USER_PASSWORD}:${authPepper}`,
    BLOCKED_USER_SALT,
    64
  ).toString('base64');

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  await prisma.program.upsert({
    where: { id: IDS.programDemo },
    update: {
      code: 'demo-program',
      name: 'Demo Program',
      status: 'active',
      metadata: { seeded: true }
    },
    create: {
      id: IDS.programDemo,
      code: 'demo-program',
      name: 'Demo Program',
      status: 'active',
      metadata: { seeded: true }
    }
  });

  await prisma.program.upsert({
    where: { id: IDS.programExtra },
    update: {
      code: 'extra-program',
      name: 'Extra Program',
      status: 'active',
      metadata: { seeded: true }
    },
    create: {
      id: IDS.programExtra,
      code: 'extra-program',
      name: 'Extra Program',
      status: 'active',
      metadata: { seeded: true }
    }
  });

  await prisma.plan.upsert({
    where: { id: IDS.planBasic },
    update: {
      code: 'basic',
      name: 'Basic',
      maxDevices: 1,
      maxOfflineHours: 72,
      features: ['validate', 'heartbeat']
    },
    create: {
      id: IDS.planBasic,
      code: 'basic',
      name: 'Basic',
      maxDevices: 1,
      maxOfflineHours: 72,
      features: ['validate', 'heartbeat']
    }
  });

  await prisma.plan.upsert({
    where: { id: IDS.planPro },
    update: {
      code: 'pro',
      name: 'Pro',
      maxDevices: 2,
      maxOfflineHours: 168,
      features: ['validate', 'activate', 'heartbeat', 'transfer']
    },
    create: {
      id: IDS.planPro,
      code: 'pro',
      name: 'Pro',
      maxDevices: 2,
      maxOfflineHours: 168,
      features: ['validate', 'activate', 'heartbeat', 'transfer']
    }
  });

  await prisma.planProgram.upsert({
    where: { id: IDS.planProgramBasicDemo },
    update: {
      planId: IDS.planBasic,
      programId: IDS.programDemo
    },
    create: {
      id: IDS.planProgramBasicDemo,
      planId: IDS.planBasic,
      programId: IDS.programDemo
    }
  });

  await prisma.planProgram.upsert({
    where: { id: IDS.planProgramProDemo },
    update: {
      planId: IDS.planPro,
      programId: IDS.programDemo
    },
    create: {
      id: IDS.planProgramProDemo,
      planId: IDS.planPro,
      programId: IDS.programDemo
    }
  });

  await prisma.customer.upsert({
    where: { id: IDS.customerDemo },
    update: {
      email: 'demo@example.com',
      name: 'Cliente Demo'
    },
    create: {
      id: IDS.customerDemo,
      email: 'demo@example.com',
      name: 'Cliente Demo'
    }
  });

  await prisma.endUser.upsert({
    where: { id: IDS.endUserDemo },
    update: {
      customerId: IDS.customerDemo,
      identifier: END_USER_IDENTIFIER,
      passwordHash: endUserPasswordHash,
      passwordSalt: END_USER_SALT,
      hashVersion: 'scrypt_v1',
      status: 'active'
    },
    create: {
      id: IDS.endUserDemo,
      customerId: IDS.customerDemo,
      identifier: END_USER_IDENTIFIER,
      passwordHash: endUserPasswordHash,
      passwordSalt: END_USER_SALT,
      hashVersion: 'scrypt_v1',
      status: 'active'
    }
  });

  await prisma.endUser.upsert({
    where: { id: IDS.endUserBlocked },
    update: {
      customerId: IDS.customerDemo,
      identifier: BLOCKED_USER_IDENTIFIER,
      passwordHash: blockedUserPasswordHash,
      passwordSalt: BLOCKED_USER_SALT,
      hashVersion: 'scrypt_v1',
      status: 'blocked'
    },
    create: {
      id: IDS.endUserBlocked,
      customerId: IDS.customerDemo,
      identifier: BLOCKED_USER_IDENTIFIER,
      passwordHash: blockedUserPasswordHash,
      passwordSalt: BLOCKED_USER_SALT,
      hashVersion: 'scrypt_v1',
      status: 'blocked'
    }
  });

  await prisma.clientCredential.upsert({
    where: { id: IDS.credentialDemo },
    update: {
      programId: IDS.programDemo,
      identifier: DEMO_IDENTIFIER,
      passwordHash: demoPasswordHash,
      passwordSalt: DEMO_SALT,
      hashVersion: 'scrypt_v1',
      isActive: true
    },
    create: {
      id: IDS.credentialDemo,
      programId: IDS.programDemo,
      identifier: DEMO_IDENTIFIER,
      passwordHash: demoPasswordHash,
      passwordSalt: DEMO_SALT,
      hashVersion: 'scrypt_v1',
      isActive: true
    }
  });

  await prisma.subscription.upsert({
    where: { id: IDS.subscriptionActive },
    update: {
      customerId: IDS.customerDemo,
      planId: IDS.planBasic,
      status: 'active',
      startAt: yesterday,
      endAt: thirtyDaysFromNow,
      autoRenew: true,
      metadata: { seeded: true, key: 'active-subscription' }
    },
    create: {
      id: IDS.subscriptionActive,
      customerId: IDS.customerDemo,
      planId: IDS.planBasic,
      status: 'active',
      startAt: yesterday,
      endAt: thirtyDaysFromNow,
      autoRenew: true,
      metadata: { seeded: true, key: 'active-subscription' }
    }
  });

  await prisma.subscription.upsert({
    where: { id: IDS.subscriptionExpired },
    update: {
      customerId: IDS.customerDemo,
      planId: IDS.planBasic,
      status: 'expired',
      startAt: thirtyDaysAgo,
      endAt: yesterday,
      autoRenew: false,
      metadata: { seeded: true, key: 'expired-subscription' }
    },
    create: {
      id: IDS.subscriptionExpired,
      customerId: IDS.customerDemo,
      planId: IDS.planBasic,
      status: 'expired',
      startAt: thirtyDaysAgo,
      endAt: yesterday,
      autoRenew: false,
      metadata: { seeded: true, key: 'expired-subscription' }
    }
  });

  await prisma.license.upsert({
    where: { id: IDS.licenseActive },
    update: {
      subscriptionId: IDS.subscriptionActive,
      licenseKey: 'LIC-DEMO-ACTIVE-0001',
      status: 'active',
      maxOfflineHours: 72
    },
    create: {
      id: IDS.licenseActive,
      subscriptionId: IDS.subscriptionActive,
      licenseKey: 'LIC-DEMO-ACTIVE-0001',
      status: 'active',
      maxOfflineHours: 72
    }
  });

  await prisma.license.upsert({
    where: { id: IDS.licenseBlocked },
    update: {
      subscriptionId: IDS.subscriptionActive,
      licenseKey: 'LIC-BLK-DEMO-0002',
      status: 'blocked',
      maxOfflineHours: 72
    },
    create: {
      id: IDS.licenseBlocked,
      subscriptionId: IDS.subscriptionActive,
      licenseKey: 'LIC-BLK-DEMO-0002',
      status: 'blocked',
      maxOfflineHours: 72
    }
  });

  await prisma.license.upsert({
    where: { id: IDS.licenseExpired },
    update: {
      subscriptionId: IDS.subscriptionExpired,
      licenseKey: 'LIC-EXP-DEMO-0003',
      status: 'active',
      maxOfflineHours: 72
    },
    create: {
      id: IDS.licenseExpired,
      subscriptionId: IDS.subscriptionExpired,
      licenseKey: 'LIC-EXP-DEMO-0003',
      status: 'active',
      maxOfflineHours: 72
    }
  });

  await prisma.license.upsert({
    where: { id: IDS.licenseTransferLimit },
    update: {
      subscriptionId: IDS.subscriptionActive,
      licenseKey: 'LIC-LIM-TRN-0004',
      status: 'active',
      maxOfflineHours: 72
    },
    create: {
      id: IDS.licenseTransferLimit,
      subscriptionId: IDS.subscriptionActive,
      licenseKey: 'LIC-LIM-TRN-0004',
      status: 'active',
      maxOfflineHours: 72
    }
  });

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 1, 0, 0, 0));

  await prisma.auditLog.upsert({
    where: { id: IDS.auditTransfer1 },
    update: {
      entityType: 'license',
      entityId: IDS.licenseTransferLimit,
      action: 'license_transfer',
      payload: { seeded: true, index: 1 },
      createdAt: monthStart
    },
    create: {
      id: IDS.auditTransfer1,
      entityType: 'license',
      entityId: IDS.licenseTransferLimit,
      action: 'license_transfer',
      payload: { seeded: true, index: 1 },
      createdAt: monthStart
    }
  });

  await prisma.auditLog.upsert({
    where: { id: IDS.auditTransfer2 },
    update: {
      entityType: 'license',
      entityId: IDS.licenseTransferLimit,
      action: 'license_transfer',
      payload: { seeded: true, index: 2 },
      createdAt: new Date(monthStart.getTime() + 60 * 60 * 1000)
    },
    create: {
      id: IDS.auditTransfer2,
      entityType: 'license',
      entityId: IDS.licenseTransferLimit,
      action: 'license_transfer',
      payload: { seeded: true, index: 2 },
      createdAt: new Date(monthStart.getTime() + 60 * 60 * 1000)
    }
  });

  await prisma.auditLog.upsert({
    where: { id: IDS.auditTransfer3 },
    update: {
      entityType: 'license',
      entityId: IDS.licenseTransferLimit,
      action: 'license_transfer',
      payload: { seeded: true, index: 3 },
      createdAt: new Date(monthStart.getTime() + 2 * 60 * 60 * 1000)
    },
    create: {
      id: IDS.auditTransfer3,
      entityType: 'license',
      entityId: IDS.licenseTransferLimit,
      action: 'license_transfer',
      payload: { seeded: true, index: 3 },
      createdAt: new Date(monthStart.getTime() + 2 * 60 * 60 * 1000)
    }
  });

  // eslint-disable-next-line no-console
  console.log('Seed completed: canonical demo data is ready.');
}

seed()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
