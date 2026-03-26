import type { PrismaService } from '../../../../infra/prisma/prisma.service';
import type {
  AdminOperationalSummary,
  GetOperationalSummaryInput
} from '../../ports/admin-backoffice.port';
import { PrismaAdminBackofficeSupport } from './prisma-admin-backoffice-support';

export class PrismaAdminOperationalSummaryReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: PrismaAdminBackofficeSupport
  ) {}

  async getOperationalSummary(
    input: GetOperationalSummaryInput = {}
  ): Promise<AdminOperationalSummary> {
    const windowDays = input.windowDays
      ? this.support.normalizePositiveInteger(input.windowDays, 'window_days')
      : 30;
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const now = new Date();

    const [
      customers,
      subscriptionsActive,
      licenses,
      licensesActive,
      devicesActive,
      validationFailures,
      securityEventsCritical,
      transferEvents,
      deactivateEvents
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.subscription.count({
        where: {
          status: 'active',
          endAt: { gt: now }
        }
      }),
      this.prisma.license.count(),
      this.prisma.license.count({
        where: { status: 'active' }
      }),
      this.prisma.licenseDevice.count({
        where: { isActive: true }
      }),
      this.prisma.validationHistory.count({
        where: {
          success: false,
          createdAt: { gte: windowStart }
        }
      }),
      this.prisma.securityEvent.count({
        where: {
          severity: 'critical',
          createdAt: { gte: windowStart }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          action: 'license_transfer',
          createdAt: { gte: windowStart }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          action: 'license_deactivate',
          createdAt: { gte: windowStart }
        }
      })
    ]);

    return {
      generatedAt: now.toISOString(),
      windowDays,
      totals: {
        customers,
        subscriptionsActive,
        licenses,
        licensesActive,
        devicesActive
      },
      recent: {
        validationFailures,
        securityEventsCritical,
        transferEvents,
        deactivateEvents
      }
    };
  }
}
