import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './controllers/auth.controller';
import { JwksController } from './controllers/jwks.controller';
import { AuthInternalUsersController } from './controllers/auth-internal-users.controller';
import { AccessTokenGuard } from './guards/access-token.guard';
import { EndUserAuthService } from './services/end-user-auth.service';
import { EndUserAdminService } from './services/end-user-admin.service';
import { AuthRateLimitService } from './services/auth-rate-limit.service';
import { EntitlementResolverService } from './services/entitlement-resolver.service';
import { OidcProviderService } from './services/oidc-provider.service';
import { CatalogBillingModule } from '../catalog-billing/catalog-billing.module';
import { DeviceTrustModule } from '../device-trust/device-trust.module';
import { OfflineEntitlementModule } from '../offline-entitlement/offline-entitlement.module';
import { InternalApiKeyGuard } from '../admin-backoffice/guards/internal-api-key.guard';

@Module({
  imports: [JwtModule.register({}), CatalogBillingModule, DeviceTrustModule, OfflineEntitlementModule],
  controllers: [AuthController, JwksController, AuthInternalUsersController],
  providers: [
    EndUserAuthService,
    EndUserAdminService,
    AuthRateLimitService,
    OidcProviderService,
    EntitlementResolverService,
    AccessTokenGuard,
    InternalApiKeyGuard
  ],
  exports: [EndUserAuthService]
})
export class EndUserAuthModule {}
