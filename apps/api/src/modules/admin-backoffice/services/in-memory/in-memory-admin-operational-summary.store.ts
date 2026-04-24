import {
  AdminOperationalSummary,
  GetOperationalSummaryInput
} from '../../ports/admin-backoffice.port';
import { InMemoryAdminBackofficeState } from './in-memory-admin-backoffice.state';

export class InMemoryAdminOperationalSummaryStore {
  constructor(private readonly state: InMemoryAdminBackofficeState) {}

  async getOperationalSummary(
    input: GetOperationalSummaryInput = {}
  ): Promise<AdminOperationalSummary> {
    const windowDays = input.windowDays ? this.state.normalizePositiveInteger(input.windowDays, 'window_days') : 30;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const devicesActive = Array.from(this.state.devicesByLicenseId.values()).reduce(
      (total, records) => total + records.filter((record) => record.isActive).length,
      0
    );

    return {
      generatedAt: now.toISOString(),
      windowDays,
      totals: {
        customers: this.state.customersById.size,
        subscriptionsActive: Array.from(this.state.subscriptionsById.values()).filter(
          (subscription) => subscription.status === 'active' && subscription.endAt > now
        ).length,
        licenses: this.state.licensesById.size,
        licensesActive: Array.from(this.state.licensesById.values()).filter(
          (license) => license.status === 'active'
        ).length,
        devicesActive
      },
      recent: {
        validationFailures: this.state.validationFailures.filter((date) => date >= windowStart).length,
        securityEventsCritical: this.state.securityCriticalEvents.filter((date) => date >= windowStart).length,
        transferEvents: this.state.auditLogs.filter(
          (record) => record.action === 'license_transfer' && record.createdAt >= windowStart
        ).length,
        deactivateEvents: this.state.auditLogs.filter(
          (record) => record.action === 'license_deactivate' && record.createdAt >= windowStart
        ).length
      }
    };
  }
}
