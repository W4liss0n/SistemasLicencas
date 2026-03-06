import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { AppConfigService } from '../../../config/app-config.service';
import { MetricsService } from '../../../observability/metrics.service';
import {
  CATALOG_BILLING_POLICY_PORT,
  CatalogBillingPolicyPort
} from '../../catalog-billing/ports/catalog-billing-policy.port';
import { DEVICE_TRUST_PORT, DeviceTrustPort } from '../../device-trust/ports/device-trust.port';
import {
  OFFLINE_ENTITLEMENT_PORT,
  OfflineEntitlementPort
} from '../../offline-entitlement/ports/offline-entitlement.port';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { EntitlementResolverService, type ResolvedEntitlement } from './entitlement-resolver.service';
import { OidcProviderService } from './oidc-provider.service';
import { LoginRequestDto, RefreshRequestDto } from '../dto/auth.dto';

export interface AccessTokenClaims {
  type: 'access';
  sub: string;
  sid: string;
  program_id: string;
  iat?: number;
  exp?: number;
}

interface RefreshTokenClaims {
  type: 'refresh';
  sub: string;
  sid: string;
  program_id: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class EndUserAuthService {
  constructor(
    @Inject(AppConfigService) private readonly configService: AppConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(CATALOG_BILLING_POLICY_PORT)
    private readonly catalogBillingPolicy: CatalogBillingPolicyPort,
    @Inject(DEVICE_TRUST_PORT)
    private readonly deviceTrust: DeviceTrustPort,
    @Inject(OFFLINE_ENTITLEMENT_PORT)
    private readonly offlineEntitlement: OfflineEntitlementPort,
    @Inject(OidcProviderService)
    private readonly oidcProvider: OidcProviderService,
    @Inject(AuthRateLimitService)
    private readonly rateLimitService: AuthRateLimitService,
    @Inject(EntitlementResolverService)
    private readonly entitlementResolver: EntitlementResolverService,
    @Inject(MetricsService)
    private readonly metricsService: MetricsService
  ) {}

  async getOidcConfig() {
    this.ensureEnabled();
    return this.oidcProvider.getPublicConfig();
  }

  async login(programIdHeader: string, payload: LoginRequestDto, ipAddress?: string) {
    this.ensureEnabled();

    await this.rateLimitService.assertWithinLimit({
      key: `login:${programIdHeader}:${ipAddress ?? 'unknown'}`,
      max: 10,
      windowSeconds: 60,
      detail: 'Too many login attempts, please retry in a minute'
    });

    const program = await this.resolveProgram(programIdHeader);
    const parsedFingerprint = this.parseFingerprint(payload.device_fingerprint.raw_components);
    this.validateRedirectUri(payload.redirect_uri);

    const identity = await this.oidcProvider.exchangeAuthorizationCode({
      authorizationCode: payload.authorization_code,
      codeVerifier: payload.code_verifier,
      redirectUri: payload.redirect_uri,
      nonce: payload.nonce
    });

    const identifier = identity.email;

    const users = await this.prisma.endUser.findMany({
      where: {
        identifier
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (users.length === 0) {
      if (!this.configService.endUserAuthAutoProvision) {
        this.metricsService.incrementAuthOidcLoginFailure('invalid_credentials', program.code);
        throw new DomainHttpError({
          status: HttpStatus.UNAUTHORIZED,
          code: 'invalid_credentials',
          detail: 'Invalid credentials',
          title: 'Invalid credentials'
        });
      }

      const autoProvisionedUser = await this.autoProvisionUser({
        identifier,
        program,
        ipAddress,
        identity
      });

      if (autoProvisionedUser.status !== 'active') {
        return this.issueLoginForUser({
          program,
          user: autoProvisionedUser,
          parsedFingerprint,
          ipAddress,
          identifier,
          shouldBindIdentity: false,
          identity
        });
      }

      const entitlement = await this.entitlementResolver.resolveForProgram({
        customerId: autoProvisionedUser.customerId,
        programId: program.id
      });

      if (!entitlement) {
        await this.writeAuthAudit({
          userId: autoProvisionedUser.id,
          programId: program.id,
          eventType: 'oidc_login_pending_plan',
          ipAddress,
          metadata: {
            identifier
          }
        });
        this.metricsService.incrementAuthOidcLoginPending(program.code);
        throw new DomainHttpError({
          status: HttpStatus.FORBIDDEN,
          code: 'access_pending',
          detail: 'User account is awaiting plan assignment',
          title: 'Access pending'
        });
      }

      return this.issueLoginForUser({
        program,
        user: autoProvisionedUser,
        parsedFingerprint,
        ipAddress,
        identifier,
        shouldBindIdentity: false,
        identity,
        entitlement
      });
    }

    const exactIdentityMatch = users.find(
      (user) => user.oidcIssuer === identity.issuer && user.oidcSubject === identity.subject
    );

    if (exactIdentityMatch) {
      return this.issueLoginForUser({
        program,
        user: exactIdentityMatch,
        parsedFingerprint,
        ipAddress,
        identifier,
        shouldBindIdentity: false,
        identity
      });
    }

    const unboundUsers = users.filter((user) => !user.oidcIssuer && !user.oidcSubject);
    if (unboundUsers.length === 0) {
      await this.writeAuthAudit({
        userId: users[0].id,
        programId: program.id,
        eventType: 'oidc_login_failure',
        ipAddress,
        metadata: {
          identifier,
          reason: 'subject_mismatch'
        }
      });

      this.metricsService.incrementAuthOidcLoginFailure('invalid_credentials', program.code);
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'invalid_credentials',
        detail: 'Invalid credentials',
        title: 'Invalid credentials'
      });
    }

    const activeUsers = unboundUsers.filter((user) => user.status === 'active');
    if (activeUsers.length === 0) {
      const blockedUser = unboundUsers[0];
      await this.writeAuthAudit({
        userId: blockedUser.id,
        programId: program.id,
        eventType: 'oidc_login_failure',
        ipAddress,
        metadata: {
          identifier,
          reason: 'user_blocked'
        }
      });

      this.metricsService.incrementAuthOidcLoginFailure('user_blocked', program.code);
      throw new DomainHttpError({
        status: HttpStatus.FORBIDDEN,
        code: 'user_blocked',
        detail: 'User is blocked',
        title: 'User blocked'
      });
    }

    for (const candidate of activeUsers) {
      const entitlement = await this.entitlementResolver.resolveForProgram({
        customerId: candidate.customerId,
        programId: program.id
      });

      if (!entitlement) {
        continue;
      }

      return this.issueLoginForUser({
        program,
        user: candidate,
        parsedFingerprint,
        ipAddress,
        identifier,
        shouldBindIdentity: true,
        identity,
        entitlement
      });
    }

    await this.writeAuthAudit({
      userId: activeUsers[0].id,
      programId: program.id,
      eventType: 'oidc_login_failure',
      ipAddress,
      metadata: {
        identifier,
        reason: 'entitlement_denied'
      }
    });

    this.metricsService.incrementAuthOidcLoginFailure('entitlement_denied', program.code);
    throw new DomainHttpError({
      status: HttpStatus.FORBIDDEN,
      code: 'entitlement_denied',
      detail: 'User customer does not have access to this program',
      title: 'Entitlement denied'
    });
  }

  async refresh(programIdHeader: string, payload: RefreshRequestDto, ipAddress?: string) {
    this.ensureEnabled();

    await this.rateLimitService.assertWithinLimit({
      key: `refresh:${programIdHeader}:${ipAddress ?? 'unknown'}`,
      max: 30,
      windowSeconds: 60,
      detail: 'Too many refresh attempts, please retry in a minute'
    });

    const program = await this.resolveProgram(programIdHeader);
    const claims = await this.verifyRefreshToken(payload.refresh_token);

    if (claims.program_id !== program.id) {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'session_revoked',
        detail: 'Refresh token program mismatch',
        title: 'Session revoked'
      });
    }

    const session = await this.prisma.endUserSession.findUnique({
      where: {
        id: claims.sid
      }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'session_revoked',
        detail: 'Refresh session is no longer valid',
        title: 'Session revoked'
      });
    }

    if (session.refreshTokenHash !== this.hashToken(payload.refresh_token)) {
      await this.prisma.endUserSession.update({
        where: {
          id: session.id
        },
        data: {
          revokedAt: new Date(),
          revokeReason: 'refresh_replay'
        }
      });
      this.metricsService.incrementRefreshReplayDetected(program.code);
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'session_revoked',
        detail: 'Refresh token replay detected',
        title: 'Session revoked'
      });
    }

    const user = await this.prisma.endUser.findUnique({
      where: {
        id: session.userId
      }
    });

    if (!user) {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'session_revoked',
        detail: 'User session is invalid',
        title: 'Session revoked'
      });
    }

    if (user.status !== 'active') {
      await this.prisma.endUserSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          revokeReason: 'user_blocked'
        }
      });
      throw new DomainHttpError({
        status: HttpStatus.FORBIDDEN,
        code: 'user_blocked',
        detail: 'User is blocked',
        title: 'User blocked'
      });
    }

    const parsedFingerprint = this.parseFingerprint(payload.device_fingerprint.raw_components);
    if (parsedFingerprint !== session.deviceFingerprintHash) {
      this.metricsService.incrementOfflineLoginBlocked('fingerprint_mismatch');
      throw new DomainHttpError({
        status: HttpStatus.FORBIDDEN,
        code: 'offline_not_allowed',
        detail: 'Refresh requires the same device fingerprint used at login',
        title: 'Offline not allowed'
      });
    }

    const entitlement = this.entitlementResolver.ensureResolved(
      await this.entitlementResolver.resolveForProgram({
        customerId: user.customerId,
        programId: program.id
      })
    );

    const issued = await this.issueSessionTokens({
      userId: user.id,
      sessionId: session.id,
      programId: program.id,
      programCode: program.code,
      fingerprintHash: session.deviceFingerprintHash,
      entitlement
    });

    await this.prisma.endUserSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashToken(issued.refreshToken),
        expiresAt: new Date(issued.refreshExpiresAt),
        revokedAt: null,
        revokeReason: null
      }
    });

    await this.writeAuthAudit({
      userId: user.id,
      programId: program.id,
      eventType: 'refresh_success',
      ipAddress,
      metadata: {
        session_id: session.id
      }
    });

    this.metricsService.incrementOfflineLoginAttempt('refreshed');

    return {
      success: true as const,
      access_token: issued.accessToken,
      access_expires_at: issued.accessExpiresAt,
      refresh_token: issued.refreshToken,
      refresh_expires_at: issued.refreshExpiresAt,
      offline_token: issued.offlineToken,
      offline_expires_at: issued.offlineExpiresAt,
      server_time_ms: Date.now(),
      max_offline_hours: this.configService.offlineMaxHours,
      entitlements: [this.toEntitlementResponse(entitlement)]
    };
  }

  async logout(programIdHeader: string, refreshToken: string, ipAddress?: string) {
    this.ensureEnabled();
    const program = await this.resolveProgram(programIdHeader);

    const claims = await this.verifyRefreshToken(refreshToken);
    if (claims.program_id !== program.id) {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'session_revoked',
        detail: 'Refresh token program mismatch',
        title: 'Session revoked'
      });
    }

    const session = await this.prisma.endUserSession.findUnique({
      where: { id: claims.sid }
    });

    if (session && !session.revokedAt) {
      await this.prisma.endUserSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          revokeReason: 'logout'
        }
      });

      await this.writeAuthAudit({
        userId: session.userId,
        programId: session.programId,
        eventType: 'logout',
        ipAddress,
        metadata: {
          session_id: session.id
        }
      });
    }

    return {
      success: true as const
    };
  }

  async me(programIdHeader: string, claims: AccessTokenClaims) {
    this.ensureEnabled();
    const program = await this.resolveProgram(programIdHeader);

    if (claims.program_id !== program.id) {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'session_revoked',
        detail: 'Access token program mismatch',
        title: 'Session revoked'
      });
    }

    const session = await this.prisma.endUserSession.findUnique({
      where: {
        id: claims.sid
      }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'session_revoked',
        detail: 'Access session is no longer valid',
        title: 'Session revoked'
      });
    }

    const user = await this.prisma.endUser.findUnique({
      where: {
        id: claims.sub
      }
    });

    if (!user || user.status !== 'active') {
      throw new DomainHttpError({
        status: HttpStatus.FORBIDDEN,
        code: 'user_blocked',
        detail: 'User is blocked',
        title: 'User blocked'
      });
    }

    const entitlement = this.entitlementResolver.ensureResolved(
      await this.entitlementResolver.resolveForProgram({
        customerId: user.customerId,
        programId: program.id
      })
    );

    return {
      success: true as const,
      user: {
        id: user.id,
        customer_id: user.customerId,
        identifier: user.identifier,
        status: user.status,
        last_login_at: user.lastLoginAt ? user.lastLoginAt.toISOString() : null
      },
      entitlement: this.toEntitlementResponse(entitlement)
    };
  }

  async verifyAccessToken(accessToken: string): Promise<AccessTokenClaims> {
    this.ensureEnabled();

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

  private async verifyRefreshToken(refreshToken: string): Promise<RefreshTokenClaims> {
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

  private async issueLoginForUser(params: {
    program: { id: string; code: string };
    user: {
      id: string;
      customerId: string;
      status: 'active' | 'blocked';
      oidcIssuer: string | null;
      oidcSubject: string | null;
    };
    parsedFingerprint: string;
    ipAddress?: string;
    identifier: string;
    identity: {
      issuer: string;
      subject: string;
    };
    shouldBindIdentity: boolean;
    entitlement?: ResolvedEntitlement;
  }) {
    if (params.user.status !== 'active') {
      await this.writeAuthAudit({
        userId: params.user.id,
        programId: params.program.id,
        eventType: 'oidc_login_failure',
        ipAddress: params.ipAddress,
        metadata: {
          identifier: params.identifier,
          reason: 'user_blocked'
        }
      });

      this.metricsService.incrementAuthOidcLoginFailure('user_blocked', params.program.code);
      throw new DomainHttpError({
        status: HttpStatus.FORBIDDEN,
        code: 'user_blocked',
        detail: 'User is blocked',
        title: 'User blocked'
      });
    }

    const entitlement =
      params.entitlement ??
      (await this.entitlementResolver.resolveForProgram({
        customerId: params.user.customerId,
        programId: params.program.id
      }));

    if (!entitlement) {
      this.metricsService.incrementAuthOidcLoginFailure('entitlement_denied', params.program.code);
      throw new DomainHttpError({
        status: HttpStatus.FORBIDDEN,
        code: 'entitlement_denied',
        detail: 'User customer does not have access to this program',
        title: 'Entitlement denied'
      });
    }

    const now = new Date();
    const refreshExpiresAt = new Date(
      now.getTime() + this.configService.refreshTtlDays * 24 * 60 * 60 * 1000
    );

    const session = await this.prisma.endUserSession.create({
      data: {
        userId: params.user.id,
        programId: params.program.id,
        deviceFingerprintHash: params.parsedFingerprint,
        refreshTokenHash: 'pending',
        expiresAt: refreshExpiresAt
      }
    });

    const issued = await this.issueSessionTokens({
      userId: params.user.id,
      sessionId: session.id,
      programId: params.program.id,
      programCode: params.program.code,
      fingerprintHash: params.parsedFingerprint,
      entitlement
    });

    const userUpdateData: Prisma.EndUserUpdateInput = {
      lastLoginAt: now
    };

    if (params.shouldBindIdentity) {
      userUpdateData.oidcIssuer = params.identity.issuer;
      userUpdateData.oidcSubject = params.identity.subject;
      userUpdateData.emailVerifiedAt = now;
    }

    await this.prisma.$transaction([
      this.prisma.endUser.update({
        where: { id: params.user.id },
        data: userUpdateData
      }),
      this.prisma.endUserSession.update({
        where: { id: session.id },
        data: {
          refreshTokenHash: this.hashToken(issued.refreshToken),
          expiresAt: new Date(issued.refreshExpiresAt)
        }
      })
    ]);

    await this.writeAuthAudit({
      userId: params.user.id,
      programId: params.program.id,
      eventType: 'oidc_login_success',
      ipAddress: params.ipAddress,
      metadata: {
        session_id: session.id
      }
    });

    this.metricsService.incrementAuthOidcLoginSuccess(params.program.code);
    this.metricsService.incrementOfflineLoginAttempt('issued');

    return {
      success: true as const,
      access_token: issued.accessToken,
      access_expires_at: issued.accessExpiresAt,
      refresh_token: issued.refreshToken,
      refresh_expires_at: issued.refreshExpiresAt,
      offline_token: issued.offlineToken,
      offline_expires_at: issued.offlineExpiresAt,
      server_time_ms: Date.now(),
      max_offline_hours: this.configService.offlineMaxHours,
      entitlements: [this.toEntitlementResponse(entitlement)]
    };
  }

  private async autoProvisionUser(params: {
    identifier: string;
    program: { id: string; code: string };
    ipAddress?: string;
    identity: {
      issuer: string;
      subject: string;
      name: string | null;
    };
  }): Promise<{
    id: string;
    customerId: string;
    status: 'active' | 'blocked';
    oidcIssuer: string | null;
    oidcSubject: string | null;
  }> {
    const now = new Date();
    const displayName = params.identity.name ?? params.identifier;

    const user = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email: params.identifier },
        update: {},
        create: {
          email: params.identifier,
          name: displayName
        }
      });

      let endUser = await tx.endUser.findUnique({
        where: {
          customerId_identifier: {
            customerId: customer.id,
            identifier: params.identifier
          }
        }
      });

      if (!endUser) {
        try {
          endUser = await tx.endUser.create({
            data: {
              customerId: customer.id,
              identifier: params.identifier,
              passwordHash: 'oidc_disabled',
              passwordSalt: 'oidc_disabled',
              hashVersion: 'oidc_v1',
              oidcIssuer: params.identity.issuer,
              oidcSubject: params.identity.subject,
              emailVerifiedAt: now,
              status: 'active'
            }
          });
        } catch (error: unknown) {
          if ((error as { code?: string })?.code !== 'P2002') {
            throw error;
          }

          endUser = await tx.endUser.findFirst({
            where: {
              OR: [
                {
                  customerId: customer.id,
                  identifier: params.identifier
                },
                {
                  oidcIssuer: params.identity.issuer,
                  oidcSubject: params.identity.subject
                }
              ]
            },
            orderBy: {
              createdAt: 'asc'
            }
          });
        }
      }

      if (!endUser) {
        throw new DomainHttpError({
          status: HttpStatus.CONFLICT,
          code: 'user_identifier_conflict',
          detail: 'User identifier already exists for this customer',
          title: 'User conflict'
        });
      }

      if (
        endUser.oidcIssuer &&
        endUser.oidcSubject &&
        (endUser.oidcIssuer !== params.identity.issuer || endUser.oidcSubject !== params.identity.subject)
      ) {
        throw new DomainHttpError({
          status: HttpStatus.UNAUTHORIZED,
          code: 'invalid_credentials',
          detail: 'Invalid credentials',
          title: 'Invalid credentials'
        });
      }

      if (!endUser.oidcIssuer || !endUser.oidcSubject || !endUser.emailVerifiedAt) {
        endUser = await tx.endUser.update({
          where: { id: endUser.id },
          data: {
            oidcIssuer: params.identity.issuer,
            oidcSubject: params.identity.subject,
            emailVerifiedAt: now
          }
        });
      }

      return {
        id: endUser.id,
        customerId: endUser.customerId,
        status: endUser.status,
        oidcIssuer: endUser.oidcIssuer,
        oidcSubject: endUser.oidcSubject
      };
    });

    await this.writeAuthAudit({
      userId: user.id,
      programId: params.program.id,
      eventType: 'oidc_auto_provisioned',
      ipAddress: params.ipAddress,
      metadata: {
        identifier: params.identifier
      }
    });

    return user;
  }

  private async issueSessionTokens(params: {
    userId: string;
    sessionId: string;
    programId: string;
    programCode: string;
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

  private parseFingerprint(input: Record<string, string>): string {
    const parsed = this.deviceTrust.parseFingerprint(input);
    if (!parsed.ok) {
      throw new DomainHttpError({
        status: HttpStatus.BAD_REQUEST,
        code: 'invalid_request',
        detail: parsed.detail,
        title: 'Invalid request'
      });
    }

    return parsed.parsed.fingerprintHash;
  }

  private validateRedirectUri(redirectUri: string): void {
    let parsed: URL;
    try {
      parsed = new URL(redirectUri);
    } catch {
      throw new DomainHttpError({
        status: HttpStatus.BAD_REQUEST,
        code: 'invalid_request',
        detail: 'redirect_uri must be a valid URL',
        title: 'Invalid request'
      });
    }

    if (
      parsed.protocol !== 'http:' ||
      parsed.hostname !== '127.0.0.1' ||
      !parsed.port ||
      parsed.username ||
      parsed.password
    ) {
      throw new DomainHttpError({
        status: HttpStatus.BAD_REQUEST,
        code: 'invalid_request',
        detail: 'redirect_uri must use loopback http://127.0.0.1:<port>',
        title: 'Invalid request'
      });
    }
  }

  private async resolveProgram(programId: string): Promise<{ id: string; code: string }> {
    const program = await this.catalogBillingPolicy.resolveAuthorizedProgram(programId);
    if (!program.ok) {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'unauthorized_program',
        detail: program.detail,
        title: 'Unauthorized program'
      });
    }

    return {
      id: program.program.id,
      code: program.program.code
    };
  }

  private toEntitlementResponse(entitlement: ResolvedEntitlement) {
    return {
      customer_id: entitlement.customerId,
      subscription_id: entitlement.subscriptionId,
      plan_code: entitlement.planCode,
      plan_name: entitlement.planName,
      program_id: entitlement.programId,
      program_code: entitlement.programCode,
      features: entitlement.features
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async writeAuthAudit(params: {
    userId: string;
    programId: string;
    eventType: string;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.authAuditEvent.create({
      data: {
        userId: params.userId,
        programId: params.programId,
        eventType: params.eventType,
        metadata: ({ ...(params.metadata ?? {}), ip: params.ipAddress ?? null }) as Prisma.InputJsonValue
      }
    });
  }

  private ensureEnabled(): void {
    if (!this.configService.endUserAuthEnabled) {
      throw new NotFoundException('Auth endpoint is disabled');
    }
  }
}
