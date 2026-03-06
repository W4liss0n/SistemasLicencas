import { Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { IdempotencyService } from '../license-runtime/services/idempotency.service';
import { AdminCatalogController } from './controllers/admin-catalog.controller';
import { AdminBackofficeController } from './controllers/admin-backoffice.controller';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';
import { ADMIN_BACKOFFICE_PORT } from './ports/admin-backoffice.port';
import { AdminBackofficeService } from './services/admin-backoffice.service';
import { InMemoryAdminBackofficeService } from './services/in-memory-admin-backoffice.service';
import { PrismaAdminBackofficeService } from './services/prisma-admin-backoffice.service';

@Module({
  controllers: [AdminBackofficeController, AdminCatalogController],
  providers: [
    AdminBackofficeService,
    InternalApiKeyGuard,
    IdempotencyService,
    InMemoryAdminBackofficeService,
    PrismaAdminBackofficeService,
    {
      provide: ADMIN_BACKOFFICE_PORT,
      inject: [AppConfigService, PrismaAdminBackofficeService, InMemoryAdminBackofficeService],
      useFactory: (
        configService: AppConfigService,
        prismaService: PrismaAdminBackofficeService,
        inMemoryService: InMemoryAdminBackofficeService
      ) => (configService.nodeEnv === 'test' ? inMemoryService : prismaService)
    }
  ],
  exports: [ADMIN_BACKOFFICE_PORT]
})
export class AdminBackofficeModule {}
