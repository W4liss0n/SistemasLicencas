import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './controllers/auth.controller';
import { JwksController } from './controllers/jwks.controller';
import { AuthInternalUsersController } from './controllers/auth-internal-users.controller';
import { AccessTokenGuard } from './guards/access-token.guard';
import { AuthAuditWriterService } from './services/auth-audit-writer.service';
import { EndUserAuthService } from './services/end-user-auth.service';
import { EndUserAdminService } from './services/end-user-admin.service';
import { AuthRateLimitService } from './services/auth-rate-limit.service';
import { CurrentUserUseCase } from './services/current-user.use-case';
import { EntitlementResolverService } from './services/entitlement-resolver.service';
import { LoginUseCase } from './services/login.use-case';
import { LogoutSessionUseCase } from './services/logout-session.use-case';
import { OidcProviderService } from './services/oidc-provider.service';
import { ProgramResolverService } from './services/program-resolver.service';
import { RefreshSessionUseCase } from './services/refresh-session.use-case';
import { SessionTokenService } from './services/session-token.service';
import { CatalogBillingModule } from '../catalog-billing/catalog-billing.module';
import { DeviceTrustModule } from '../device-trust/device-trust.module';
import { OfflineEntitlementModule } from '../offline-entitlement/offline-entitlement.module';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { InternalApiKeyGuard } from '../../common/guards/internal-api-key.guard';

@Module({
  imports: [JwtModule.register({}), CatalogBillingModule, DeviceTrustModule, OfflineEntitlementModule],
  controllers: [AuthController, JwksController, AuthInternalUsersController],
  providers: [
    EndUserAuthService,
    EndUserAdminService,
    AuthRateLimitService,
    OidcProviderService,
    EntitlementResolverService,
    ProgramResolverService,
    AuthAuditWriterService,
    SessionTokenService,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutSessionUseCase,
    CurrentUserUseCase,
    AccessTokenGuard,
    AdminAuthGuard,
    InternalApiKeyGuard
  ],
  exports: [EndUserAuthService]
})
export class EndUserAuthModule {}
