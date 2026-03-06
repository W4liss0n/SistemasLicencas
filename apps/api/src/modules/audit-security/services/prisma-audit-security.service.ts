import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  AuditSecurityPort,
  CountAuditLogsSinceInput,
  WriteAuditLogInput,
  WriteSecurityEventInput,
  WriteValidationHistoryInput
} from '../ports/audit-security.port';

@Injectable()
export class PrismaAuditSecurityService implements AuditSecurityPort {
  private readonly logger = new Logger(PrismaAuditSecurityService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async writeValidationHistory(input: WriteValidationHistoryInput): Promise<void> {
    if (this.shouldSkipPersistence()) {
      return;
    }

    try {
      await this.prisma.validationHistory.create({
        data: {
          licenseKey: input.licenseKey,
          success: input.success,
          errorCode: input.errorCode,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      this.logger.warn(`Skipping validation history persistence: ${String(error)}`);
    }
  }

  async writeSecurityEvent(input: WriteSecurityEventInput): Promise<void> {
    if (this.shouldSkipPersistence()) {
      return;
    }

    try {
      await this.prisma.securityEvent.create({
        data: {
          eventType: input.eventType,
          severity: input.severity,
          details: (input.details ?? {}) as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      this.logger.warn(`Skipping security event persistence: ${String(error)}`);
    }
  }

  async writeAuditLog(input: WriteAuditLogInput): Promise<void> {
    if (this.shouldSkipPersistence()) {
      return;
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          payload: (input.payload ?? {}) as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      this.logger.warn(`Skipping audit log persistence: ${String(error)}`);
    }
  }

  async countAuditLogsSince(input: CountAuditLogsSinceInput): Promise<number> {
    if (this.shouldSkipPersistence()) {
      return 0;
    }

    try {
      return await this.prisma.auditLog.count({
        where: {
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          createdAt: {
            gte: input.since
          }
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to count audit logs: ${String(error)}`);
      return 0;
    }
  }

  private shouldSkipPersistence(): boolean {
    return process.env.NODE_ENV === 'test' && process.env.RUN_PRISMA_CONTRACT !== 'true';
  }
}
