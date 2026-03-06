import { Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { IDENTITY_ACCESS_PORT } from './ports/identity-access.port';
import { IdentityPasswordHasherService } from './services/identity-password-hasher.service';
import { InMemoryIdentityAccessService } from './services/in-memory-identity-access.service';
import { PrismaIdentityAccessService } from './services/prisma-identity-access.service';

@Module({
  providers: [
    IdentityPasswordHasherService,
    InMemoryIdentityAccessService,
    PrismaIdentityAccessService,
    {
      provide: IDENTITY_ACCESS_PORT,
      inject: [AppConfigService, InMemoryIdentityAccessService, PrismaIdentityAccessService],
      useFactory: (
        appConfigService: AppConfigService,
        inMemoryIdentityAccess: InMemoryIdentityAccessService,
        prismaIdentityAccess: PrismaIdentityAccessService
      ) => {
        return appConfigService.nodeEnv === 'test'
          ? inMemoryIdentityAccess
          : prismaIdentityAccess;
      }
    }
  ],
  exports: [IDENTITY_ACCESS_PORT]
})
export class IdentityAccessModule {}
