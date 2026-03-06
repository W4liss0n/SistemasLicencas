import type { PrismaService } from '../../../infra/prisma/prisma.service';
import { PrismaAuditSecurityService } from './prisma-audit-security.service';

describe('PrismaAuditSecurityService', () => {
  const validationHistoryCreate = jest.fn();
  const securityEventCreate = jest.fn();
  const auditLogCreate = jest.fn();
  const auditLogCount = jest.fn();

  const prisma = {
    validationHistory: {
      create: validationHistoryCreate
    },
    securityEvent: {
      create: securityEventCreate
    },
    auditLog: {
      create: auditLogCreate,
      count: auditLogCount
    }
  } as unknown as PrismaService;

  const service = new PrismaAuditSecurityService(prisma);
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRunPrismaContract = process.env.RUN_PRISMA_CONTRACT;

  afterEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.RUN_PRISMA_CONTRACT = originalRunPrismaContract;
  });

  it('skips persistence in test environment', async () => {
    process.env.NODE_ENV = 'test';

    await service.writeValidationHistory({
      licenseKey: 'LIC-1',
      success: true
    });
    await service.writeSecurityEvent({
      eventType: 'evt',
      severity: 'low'
    });
    await service.writeAuditLog({
      entityType: 'license',
      entityId: 'id',
      action: 'action'
    });

    const count = await service.countAuditLogsSince({
      entityType: 'license',
      entityId: 'id',
      action: 'action',
      since: new Date()
    });

    expect(validationHistoryCreate).not.toHaveBeenCalled();
    expect(securityEventCreate).not.toHaveBeenCalled();
    expect(auditLogCreate).not.toHaveBeenCalled();
    expect(auditLogCount).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });

  it('persists records outside test environment', async () => {
    process.env.NODE_ENV = 'development';
    auditLogCount.mockResolvedValue(3);

    await service.writeValidationHistory({
      licenseKey: 'LIC-1',
      success: false,
      errorCode: 'invalid',
      metadata: { reason: 'x' }
    });
    await service.writeSecurityEvent({
      eventType: 'license_validation_failed',
      severity: 'medium',
      details: { code: 'invalid' }
    });
    await service.writeAuditLog({
      entityType: 'license',
      entityId: 'id',
      action: 'transfer',
      payload: { transfer_count_month: 1 }
    });
    const count = await service.countAuditLogsSince({
      entityType: 'license',
      entityId: 'id',
      action: 'transfer',
      since: new Date('2026-01-01T00:00:00.000Z')
    });

    expect(validationHistoryCreate).toHaveBeenCalled();
    expect(securityEventCreate).toHaveBeenCalled();
    expect(auditLogCreate).toHaveBeenCalled();
    expect(auditLogCount).toHaveBeenCalled();
    expect(count).toBe(3);
  });

  it('persists records in prisma contract mode', async () => {
    process.env.NODE_ENV = 'test';
    process.env.RUN_PRISMA_CONTRACT = 'true';
    auditLogCount.mockResolvedValue(1);

    await service.writeAuditLog({
      entityType: 'license',
      entityId: 'id',
      action: 'transfer'
    });
    const count = await service.countAuditLogsSince({
      entityType: 'license',
      entityId: 'id',
      action: 'transfer',
      since: new Date('2026-01-01T00:00:00.000Z')
    });

    expect(auditLogCreate).toHaveBeenCalled();
    expect(auditLogCount).toHaveBeenCalled();
    expect(count).toBe(1);
  });

  it('returns 0 when audit count fails', async () => {
    process.env.NODE_ENV = 'development';
    auditLogCount.mockRejectedValue(new Error('db down'));

    const count = await service.countAuditLogsSince({
      entityType: 'license',
      entityId: 'id',
      action: 'transfer',
      since: new Date()
    });

    expect(count).toBe(0);
  });
});
