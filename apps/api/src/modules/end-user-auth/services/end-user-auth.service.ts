import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import { LoginRequestDto, RefreshRequestDto } from '../dto/auth.dto';
import { CurrentUserUseCase } from './current-user.use-case';
import { LoginUseCase } from './login.use-case';
import { LogoutSessionUseCase } from './logout-session.use-case';
import { OidcProviderService } from './oidc-provider.service';
import { RefreshSessionUseCase } from './refresh-session.use-case';
import { SessionTokenService } from './session-token.service';
import type { AccessTokenClaims } from './auth-session.types';

export type { AccessTokenClaims } from './auth-session.types';

@Injectable()
export class EndUserAuthService {
  constructor(
    @Inject(AppConfigService) private readonly configService: AppConfigService,
    @Inject(OidcProviderService)
    private readonly oidcProvider: OidcProviderService,
    @Inject(LoginUseCase)
    private readonly loginUseCase: LoginUseCase,
    @Inject(RefreshSessionUseCase)
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    @Inject(LogoutSessionUseCase)
    private readonly logoutSessionUseCase: LogoutSessionUseCase,
    @Inject(CurrentUserUseCase)
    private readonly currentUserUseCase: CurrentUserUseCase,
    @Inject(SessionTokenService)
    private readonly sessionTokenService: SessionTokenService
  ) {}

  async getOidcConfig() {
    this.ensureEnabled();
    return this.oidcProvider.getPublicConfig();
  }

  async login(programIdHeader: string, payload: LoginRequestDto, ipAddress?: string) {
    this.ensureEnabled();
    return this.loginUseCase.execute(programIdHeader, payload, ipAddress);
  }

  async refresh(programIdHeader: string, payload: RefreshRequestDto, ipAddress?: string) {
    this.ensureEnabled();
    return this.refreshSessionUseCase.execute(programIdHeader, payload, ipAddress);
  }

  async logout(programIdHeader: string, refreshToken: string, ipAddress?: string) {
    this.ensureEnabled();
    return this.logoutSessionUseCase.execute(programIdHeader, refreshToken, ipAddress);
  }

  async me(programIdHeader: string, claims: AccessTokenClaims) {
    this.ensureEnabled();
    return this.currentUserUseCase.execute(programIdHeader, claims);
  }

  async verifyAccessToken(accessToken: string): Promise<AccessTokenClaims> {
    this.ensureEnabled();
    return this.sessionTokenService.verifyAccessToken(accessToken);
  }

  private ensureEnabled(): void {
    if (!this.configService.endUserAuthEnabled) {
      throw new NotFoundException('Auth endpoint is disabled');
    }
  }
}
