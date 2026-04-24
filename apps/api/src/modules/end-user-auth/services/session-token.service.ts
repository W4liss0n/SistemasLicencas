import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { AppConfigService } from '../../../config/app-config.service';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import {
  OFFLINE_ENTITLEMENT_PORT,
  OfflineEntitlementPort
} from '../../offline-entitlement/ports/offline-entitlement.port';
import type { ResolvedEntitlement } from './entitlement-resolver.service';
import type { AccessTokenClaims, RefreshTokenClaims } from './auth-session.types';

@Injectable()
export class SessionTokenService {
  constructor(
    @Inject(AppConfigService) private readonly configService: AppConfigService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(OFFLINE_ENTITLEMENT_PORT)
    private readonly offlineEntitlement: OfflineEntitlementPort
  ) {}

  async verifyAccessToken(accessToken: string): Promise<AccessTokenClaims> {
    let claims: AccessTokenClaims;
    try {
      claims = await this.jwtService.verifyAsync<AccessTokenClaims>(accessToken, {
        secret: this.configService.accessJwtSecret,
        clockTolerance: this.configService.clockSkewSeconds
      });
    } catch {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'invalid_credentials',
        detail: 'Invalid access token',
        title: 'Invalid credentials'
      });
    }

    if (claims.type !== 'access') {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'invalid_credentials',
        detail: 'Invalid access token type',
        title: 'Invalid credentials'
      });
    }

    return claims;
  }

  async verifyRefreshToken(refreshToken: string): Promise<RefreshTokenClaims> {
    let claims: RefreshTokenClaims;
    try {
      claims = await this.jwtService.verifyAsync<RefreshTokenClaims>(refreshToken, {
        secret: this.configService.refreshJwtSecret,
        clockTolerance: this.configService.clockSkewSeconds
      });
    } catch {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'session_revoked',
        detail: 'Invalid refresh token',
        title: 'Session revoked'
      });
    }

    if (claims.type !== 'refresh') {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'session_revoked',
        detail: 'Invalid refresh token type',
        title: 'Session revoked'
      });
    }

    return claims;
  }

  async issueSessionTokens(params: {
    userId: string;
    sessionId: string;
    programId: string;
    fingerprintHash: string;
    entitlement: ResolvedEntitlement;
  }): Promise<{
    accessToken: string;
    accessExpiresAt: string;
    refreshToken: string;
    refreshExpiresAt: string;
    offlineToken: string;
    offlineExpiresAt: string;
  }> {
    const now = new Date();
    const accessExpiresAt = new Date(now.getTime() + this.configService.accessTtlMinutes * 60 * 1000);
    const refreshExpiresAt = new Date(now.getTime() + this.configService.refreshTtlDays * 24 * 60 * 60 * 1000);

    const accessToken = await this.jwtService.signAsync(
      {
        type: 'access',
        sub: params.userId,
        sid: params.sessionId,
        program_id: params.programId
      },
      {
        secret: this.configService.accessJwtSecret,
        expiresIn: `${this.configService.accessTtlMinutes}m`
      }
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        type: 'refresh',
        sub: params.userId,
        sid: params.sessionId,
        program_id: params.programId,
        jti: randomUUID()
      },
      {
        secret: this.configService.refreshJwtSecret,
        expiresIn: `${this.configService.refreshTtlDays}d`
      }
    );

    const offline = await this.offlineEntitlement.issueOfflineSessionToken({
      userId: params.userId,
      sessionId: params.sessionId,
      programId: params.programId,
      fingerprintHash: params.fingerprintHash,
      entitlements: params.entitlement.features,
      maxOfflineHours: this.configService.offlineMaxHours,
      issuedAt: now
    });

    return {
      accessToken,
      accessExpiresAt: accessExpiresAt.toISOString(),
      refreshToken,
      refreshExpiresAt: refreshExpiresAt.toISOString(),
      offlineToken: offline.token,
      offlineExpiresAt: offline.expiresAt
    };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
