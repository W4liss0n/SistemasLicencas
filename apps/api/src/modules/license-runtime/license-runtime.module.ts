import { Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { LicenseAuthController } from './controllers/license-auth.controller';
import { LicensesController } from './controllers/licenses.controller';
import { AuthenticationService } from './services/authentication.service';
import { LicenseValidationService } from './services/license-validation.service';
import { LicenseActivationService } from './services/license-activation.service';
import { LicenseHeartbeatService } from './services/license-heartbeat.service';
import { LicenseTransferService } from './services/license-transfer.service';
import { LicenseDeactivationService } from './services/license-deactivation.service';
import { IdempotencyService } from './services/idempotency.service';
import { FakeLicenseEngineAdapter } from './adapters/fake-license-engine.adapter';
import { PrismaLicenseEngineAdapter } from './adapters/prisma-license-engine.adapter';
import { LICENSE_ENGINE_PORT } from './ports/license-engine.port';
import { resolveLicenseEngineStrategy } from './license-engine-strategy';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CatalogBillingModule } from '../catalog-billing/catalog-billing.module';
import { DeviceTrustModule } from '../device-trust/device-trust.module';
import { IdentityAccessModule } from '../identity-access/identity-access.module';
import { AuditSecurityModule } from '../audit-security/audit-security.module';
import { OfflineEntitlementModule } from '../offline-entitlement/offline-entitlement.module';

@Module({
  imports: [
    SubscriptionModule,
    CatalogBillingModule,
    DeviceTrustModule,
    IdentityAccessModule,
    AuditSecurityModule,
    OfflineEntitlementModule
  ],
  controllers: [LicenseAuthController, LicensesController],
  providers: [
    AuthenticationService,
    LicenseValidationService,
    LicenseActivationService,
    LicenseHeartbeatService,
    LicenseTransferService,
    LicenseDeactivationService,
    IdempotencyService,
    FakeLicenseEngineAdapter,
    PrismaLicenseEngineAdapter,
    {
      provide: LICENSE_ENGINE_PORT,
      inject: [AppConfigService, FakeLicenseEngineAdapter, PrismaLicenseEngineAdapter],
      useFactory: (
        appConfigService: AppConfigService,
        fakeLicenseEngine: FakeLicenseEngineAdapter,
        prismaLicenseEngine: PrismaLicenseEngineAdapter
      ) => {
        const strategy = resolveLicenseEngineStrategy(
          appConfigService.nodeEnv,
          appConfigService.licenseEngineStrategy
        );
        return strategy === 'fake' ? fakeLicenseEngine : prismaLicenseEngine;
      }
    }
  ]
})
export class LicenseRuntimeModule {}
