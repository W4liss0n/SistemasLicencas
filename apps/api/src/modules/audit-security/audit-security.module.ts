import { Module } from '@nestjs/common';
import { AUDIT_SECURITY_PORT } from './ports/audit-security.port';
import { PrismaAuditSecurityService } from './services/prisma-audit-security.service';

@Module({
  providers: [
    PrismaAuditSecurityService,
    {
      provide: AUDIT_SECURITY_PORT,
      useExisting: PrismaAuditSecurityService
    }
  ],
  exports: [AUDIT_SECURITY_PORT]
})
export class AuditSecurityModule {}
