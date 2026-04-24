import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppConfigService } from '../../../config/app-config.service';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { MetricsService } from '../../../observability/metrics.service';
import { DEVICE_TRUST_PORT, DeviceTrustPort } from '../../device-trust/ports/device-trust.port';
import { LoginRequestDto } from '../dto/auth.dto';
import { AuthAuditWriterService } from './auth-audit-writer.service';
import type { AuthProgram, AuthUserForLogin, OidcIdentity } from './auth-session.types';
import { toEntitlementResponse } from './auth-session.types';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { EntitlementResolverService, type ResolvedEntitlement } from './entitlement-resolver.service';
import { OidcProviderService } from './oidc-provider.service';
import { ProgramResolverService } from './program-resolver.service';
import { SessionTokenService } from './session-token.service';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(AppConfigService) private readonly configService: AppConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DEVICE_TRUST_PORT)
    private readonly deviceTrust: DeviceTrustPort,
    @Inject(OidcProviderService)
    private readonly oidcProvider: OidcProviderService,
    @Inject(AuthRateLimitService)
    private readonly rateLimitService: AuthRateLimitService,
    @Inject(EntitlementResolverService)
    private readonly entitlementResolver: EntitlementResolverService,
    @Inject(MetricsService)
    private readonly metricsService: MetricsService,
    @Inject(ProgramResolverService)
    private readonly programResolver: ProgramResolverService,
    @Inject(SessionTokenService)
    private readonly sessionTokenService: SessionTokenService,
    @Inject(AuthAuditWriterService)
    private readonly authAuditWriter: AuthAuditWriterService
  ) {}

  async execute(programIdHeader: string, payload: LoginRequestDto, ipAddress?: string) {
    await this.rateLimitService.assertWithinLimit({
      key: `login:${programIdHeader}:${ipAddress ?? 'unknown'}`,
      max: 10,
      windowSeconds: 60,
      detail: 'Too many login attempts, please retry in a minute'
    });

    const program = await this.programResolver.resolve(programIdHeader);
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
        await this.authAuditWriter.write({
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
      await this.authAuditWriter.write({
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
      await this.authAuditWriter.write({
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

    await this.authAuditWriter.write({
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

  private async issueLoginForUser(params: {
    program: AuthProgram;
    user: AuthUserForLogin;
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
      await this.authAuditWriter.write({
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

    const issued = await this.sessionTokenService.issueSessionTokens({
      userId: params.user.id,
      sessionId: session.id,
      programId: params.program.id,
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
          refreshTokenHash: this.sessionTokenService.hashToken(issued.refreshToken),
          expiresAt: new Date(issued.refreshExpiresAt)
        }
      })
    ]);

    await this.authAuditWriter.write({
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
      entitlements: [toEntitlementResponse(entitlement)]
    };
  }

  private async autoProvisionUser(params: {
    identifier: string;
    program: AuthProgram;
    ipAddress?: string;
    identity: OidcIdentity;
  }): Promise<AuthUserForLogin> {
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

    await this.authAuditWriter.write({
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
}
