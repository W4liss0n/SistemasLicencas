import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { MetricsService } from '../../../observability/metrics.service';
import { DEVICE_TRUST_PORT, DeviceTrustPort } from '../../device-trust/ports/device-trust.port';
import { RefreshRequestDto } from '../dto/auth.dto';
import { AuthAuditWriterService } from './auth-audit-writer.service';
import { toEntitlementResponse } from './auth-session.types';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { EntitlementResolverService } from './entitlement-resolver.service';
import { ProgramResolverService } from './program-resolver.service';
import { SessionTokenService } from './session-token.service';

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(AppConfigService) private readonly configService: AppConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DEVICE_TRUST_PORT)
    private readonly deviceTrust: DeviceTrustPort,
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

  async execute(programIdHeader: string, payload: RefreshRequestDto, ipAddress?: string) {
    await this.rateLimitService.assertWithinLimit({
      key: `refresh:${programIdHeader}:${ipAddress ?? 'unknown'}`,
      max: 30,
      windowSeconds: 60,
      detail: 'Too many refresh attempts, please retry in a minute'
    });

    const program = await this.programResolver.resolve(programIdHeader);
    const claims = await this.sessionTokenService.verifyRefreshToken(payload.refresh_token);

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

    if (session.refreshTokenHash !== this.sessionTokenService.hashToken(payload.refresh_token)) {
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

    const issued = await this.sessionTokenService.issueSessionTokens({
      userId: user.id,
      sessionId: session.id,
      programId: program.id,
      fingerprintHash: session.deviceFingerprintHash,
      entitlement
    });

    await this.prisma.endUserSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.sessionTokenService.hashToken(issued.refreshToken),
        expiresAt: new Date(issued.refreshExpiresAt),
        revokedAt: null,
        revokeReason: null
      }
    });

    await this.authAuditWriter.write({
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
      entitlements: [toEntitlementResponse(entitlement)]
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
}
