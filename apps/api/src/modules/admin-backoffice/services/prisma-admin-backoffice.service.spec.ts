import type { PrismaService } from '../../../infra/prisma/prisma.service';
import { PrismaAdminBackofficeService } from './prisma-admin-backoffice.service';

describe('PrismaAdminBackofficeService', () => {
  const count = jest.fn();
  const prisma = {
    customer: { count },
    subscription: { count },
    license: { count },
    licenseDevice: { count },
    validationHistory: { count },
    securityEvent: { count },
    auditLog: { count }
  } as unknown as PrismaService;

  const service = new PrismaAdminBackofficeService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns zeroed summary when database counts are zero', async () => {
    count.mockResolvedValue(0);

    const summary = await service.getOperationalSummary({ windowDays: 7 });

    expect(summary.windowDays).toBe(7);
    expect(summary.totals).toEqual({
      customers: 0,
      subscriptionsActive: 0,
      licenses: 0,
      licensesActive: 0,
      devicesActive: 0
    });
    expect(summary.recent).toEqual({
      validationFailures: 0,
      securityEventsCritical: 0,
      transferEvents: 0,
      deactivateEvents: 0
    });
  });

  it('returns aggregated counts from prisma queries', async () => {
    count
      .mockResolvedValueOnce(10) // customers
      .mockResolvedValueOnce(7) // subscriptionsActive
      .mockResolvedValueOnce(20) // licenses
      .mockResolvedValueOnce(15) // licensesActive
      .mockResolvedValueOnce(9) // devicesActive
      .mockResolvedValueOnce(4) // validationFailures
      .mockResolvedValueOnce(1) // securityEventsCritical
      .mockResolvedValueOnce(3) // transferEvents
      .mockResolvedValueOnce(2); // deactivateEvents

    const summary = await service.getOperationalSummary();

    expect(summary.windowDays).toBe(30);
    expect(summary.totals).toEqual({
      customers: 10,
      subscriptionsActive: 7,
      licenses: 20,
      licensesActive: 15,
      devicesActive: 9
    });
    expect(summary.recent).toEqual({
      validationFailures: 4,
      securityEventsCritical: 1,
      transferEvents: 3,
      deactivateEvents: 2
    });
    expect(count).toHaveBeenCalledTimes(9);
  });
});
