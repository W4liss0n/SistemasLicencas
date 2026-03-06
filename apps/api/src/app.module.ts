import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/validate-env';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { LicenseRuntimeModule } from './modules/license-runtime/license-runtime.module';
import { IdentityAccessModule } from './modules/identity-access/identity-access.module';
import { CatalogBillingModule } from './modules/catalog-billing/catalog-billing.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { DeviceTrustModule } from './modules/device-trust/device-trust.module';
import { OfflineEntitlementModule } from './modules/offline-entitlement/offline-entitlement.module';
import { AuditSecurityModule } from './modules/audit-security/audit-security.module';
import { AdminBackofficeModule } from './modules/admin-backoffice/admin-backoffice.module';
import { ObservabilityModule } from './observability/observability.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { EndUserAuthModule } from './modules/end-user-auth/end-user-auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: 'SYS:standard'
                }
              }
      }
    }),
    AppConfigModule,
    PrismaModule,
    RedisModule,
    ObservabilityModule,
    HealthModule,
    LicenseRuntimeModule,
    MetricsModule,
    IdentityAccessModule,
    CatalogBillingModule,
    SubscriptionModule,
    DeviceTrustModule,
    OfflineEntitlementModule,
    AuditSecurityModule,
    AdminBackofficeModule,
    EndUserAuthModule
  ]
})
export class AppModule {}
