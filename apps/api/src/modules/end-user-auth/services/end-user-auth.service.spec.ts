import { createHash } from 'node:crypto';
import type { JwtService } from '@nestjs/jwt';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import type { AppConfigService } from '../../../config/app-config.service';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { MetricsService } from '../../../observability/metrics.service';
import type { CatalogBillingPolicyPort } from '../../catalog-billing/ports/catalog-billing-policy.port';
import type { DeviceTrustPort } from '../../device-trust/ports/device-trust.port';
import type { OfflineEntitlementPort } from '../../offline-entitlement/ports/offline-entitlement.port';
import { EndUserAuthService } from './end-user-auth.service';
import type { AuthRateLimitService } from './auth-rate-limit.service';
import type { EntitlementResolverService, ResolvedEntitlement } from './entitlement-resolver.service';
import type { OidcProviderService } from './oidc-provider.service';

const ENTITLEMENT: ResolvedEntitlement = {
  customerId: 'customer-1',
  subscriptionId: 'subscription-1',
  planCode: 'basic',
  planName: 'Basic',
  programId: 'program-1',
  programCode: 'demo-program',
  features: ['validate', 'heartbeat']
};

type MockMap = {
  appConfig: AppConfigService;
  prisma: PrismaService;
  jwtService: JwtService;
  catalogBillingPolicy: CatalogBillingPolicyPort;
  deviceTrust: DeviceTrustPort;
  offlineEntitlement: OfflineEntitlementPort;
  oidcProvider: OidcProviderService;
  rateLimitService: AuthRateLimitService;
  entitlementResolver: EntitlementResolverService;
  metricsService: MetricsService;
  fn: {
    resolveAuthorizedProgram: jest.Mock;
    parseFingerprint: jest.Mock;
    issueOfflineSessionToken: jest.Mock;
    exchangeAuthorizationCode: jest.Mock;
    getOidcConfig: jest.Mock;
    assertWithinLimit: jest.Mock;
    resolveForProgram: jest.Mock;
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
    customerUpsert: jest.Mock;
    endUserFindMany: jest.Mock;
    endUserFindUnique: jest.Mock;
    endUserFindFirst: jest.Mock;
    endUserCreate: jest.Mock;
    endUserUpdate: jest.Mock;
    endUserSessionCreate: jest.Mock;
    endUserSessionFindUnique: jest.Mock;
    endUserSessionUpdate: jest.Mock;
    authAuditCreate: jest.Mock;
    transaction: jest.Mock;
    incrementAuthOidcLoginSuccess: jest.Mock;
    incrementAuthOidcLoginFailure: jest.Mock;
    incrementAuthOidcLoginPending: jest.Mock;
    incrementOfflineLoginAttempt: jest.Mock;
    incrementOfflineLoginBlocked: jest.Mock;
    incrementRefreshReplayDetected: jest.Mock;
  };
};

function hashToken(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function createService(): { service: EndUserAuthService; mocks: MockMap } {
  const resolveAuthorizedProgram = jest.fn().mockResolvedValue({
    ok: true,
    program: { id: 'program-1', code: 'demo-program' }
  });
  const parseFingerprint = jest.fn().mockReturnValue({
    ok: true,
    parsed: { fingerprintHash: 'sha256:fingerprint' }
  });
  const issueOfflineSessionToken = jest.fn().mockResolvedValue({
    token: 'offline-token',
    expiresAt: '2026-03-08T12:00:00.000Z'
  });
  const exchangeAuthorizationCode = jest.fn().mockResolvedValue({
    issuer: 'https://issuer.example.com',
    subject: 'oidc-subject-1',
    email: 'user.demo@example.com',
    name: 'User Demo'
  });
  const getOidcConfig = jest.fn().mockResolvedValue({
    issuer: 'https://issuer.example.com',
    client_id: 'launcher-client',
    authorization_endpoint: 'https://issuer.example.com/authorize',
    token_endpoint: 'https://issuer.example.com/oauth/token',
    scopes: ['openid', 'profile', 'email']
  });
  const assertWithinLimit = jest.fn().mockResolvedValue(undefined);
  const resolveForProgram = jest.fn().mockResolvedValue(ENTITLEMENT);
  const signAsync = jest.fn().mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');
  const verifyAsync = jest.fn();

  const customerUpsert = jest.fn().mockResolvedValue({
    id: 'customer-1',
    email: 'user.demo@example.com',
    name: 'User Demo',
    document: null,
    createdAt: new Date('2026-03-05T12:00:00.000Z'),
    updatedAt: new Date('2026-03-05T12:00:00.000Z')
  });
  const endUserFindMany = jest.fn().mockResolvedValue([]);
  const endUserFindUnique = jest.fn();
  const endUserFindFirst = jest.fn().mockResolvedValue(null);
  const endUserCreate = jest.fn().mockResolvedValue({
    id: 'user-1',
    customerId: 'customer-1',
    identifier: 'user.demo@example.com',
    oidcIssuer: 'https://issuer.example.com',
    oidcSubject: 'oidc-subject-1',
    emailVerifiedAt: new Date('2026-03-05T12:00:00.000Z'),
    status: 'active'
  });
  const endUserUpdate = jest.fn().mockResolvedValue({});
  const endUserSessionCreate = jest.fn().mockResolvedValue({ id: 'session-1' });
  const endUserSessionFindUnique = jest.fn();
  const endUserSessionUpdate = jest.fn().mockResolvedValue({});
  const authAuditCreate = jest.fn().mockResolvedValue({});
  const transaction = jest.fn().mockImplementation(async (input: unknown) => {
    if (typeof input === 'function') {
      return input({
        customer: {
          upsert: customerUpsert
        },
        endUser: {
          findUnique: endUserFindUnique,
          findFirst: endUserFindFirst,
          create: endUserCreate,
          update: endUserUpdate
        }
      });
    }

    return input;
  });

  const incrementAuthOidcLoginSuccess = jest.fn();
  const incrementAuthOidcLoginFailure = jest.fn();
  const incrementAuthOidcLoginPending = jest.fn();
  const incrementOfflineLoginAttempt = jest.fn();
  const incrementOfflineLoginBlocked = jest.fn();
  const incrementRefreshReplayDetected = jest.fn();

  const appConfig = {
    endUserAuthEnabled: true,
    endUserAuthAutoProvision: false,
    refreshTtlDays: 7,
    accessTtlMinutes: 15,
    offlineMaxHours: 72,
    accessJwtSecret: 'access-secret',
    refreshJwtSecret: 'refresh-secret',
    clockSkewSeconds: 120
  } as AppConfigService;

  const prisma = {
    customer: {
      upsert: customerUpsert
    },
    endUser: {
      findMany: endUserFindMany,
      findUnique: endUserFindUnique,
      findFirst: endUserFindFirst,
      create: endUserCreate,
      update: endUserUpdate
    },
    endUserSession: {
      create: endUserSessionCreate,
      findUnique: endUserSessionFindUnique,
      update: endUserSessionUpdate
    },
    authAuditEvent: {
      create: authAuditCreate
    },
    $transaction: transaction
  } as unknown as PrismaService;

  const jwtService = {
    signAsync,
    verifyAsync
  } as unknown as JwtService;

  const catalogBillingPolicy = {
    resolveAuthorizedProgram
  } as unknown as CatalogBillingPolicyPort;

  const deviceTrust = {
    parseFingerprint
  } as unknown as DeviceTrustPort;

  const offlineEntitlement = {
    issueOfflineSessionToken
  } as unknown as OfflineEntitlementPort;

  const oidcProvider = {
    exchangeAuthorizationCode,
    getPublicConfig: getOidcConfig
  } as unknown as OidcProviderService;

  const rateLimitService = {
    assertWithinLimit
  } as unknown as AuthRateLimitService;

  const entitlementResolver = {
    resolveForProgram,
    ensureResolved: (entitlement: ResolvedEntitlement | null) => {
      if (!entitlement) {
        throw new DomainHttpError({
          status: 403,
          code: 'entitlement_denied',
          detail: 'denied',
          title: 'Entitlement denied'
        });
      }

      return entitlement;
    }
  } as unknown as EntitlementResolverService;

  const metricsService = {
    incrementAuthOidcLoginSuccess,
    incrementAuthOidcLoginFailure,
    incrementAuthOidcLoginPending,
    incrementOfflineLoginAttempt,
    incrementOfflineLoginBlocked,
    incrementRefreshReplayDetected
  } as unknown as MetricsService;

  const service = new EndUserAuthService(
    appConfig,
    prisma,
    jwtService,
    catalogBillingPolicy,
    deviceTrust,
    offlineEntitlement,
    oidcProvider,
    rateLimitService,
    entitlementResolver,
    metricsService
  );

  return {
    service,
    mocks: {
      appConfig,
      prisma,
      jwtService,
      catalogBillingPolicy,
      deviceTrust,
      offlineEntitlement,
      oidcProvider,
      rateLimitService,
      entitlementResolver,
      metricsService,
      fn: {
        resolveAuthorizedProgram,
        parseFingerprint,
        issueOfflineSessionToken,
        exchangeAuthorizationCode,
        getOidcConfig,
        assertWithinLimit,
        resolveForProgram,
        signAsync,
        verifyAsync,
        customerUpsert,
        endUserFindMany,
        endUserFindUnique,
        endUserFindFirst,
        endUserCreate,
        endUserUpdate,
        endUserSessionCreate,
        endUserSessionFindUnique,
        endUserSessionUpdate,
        authAuditCreate,
        transaction,
        incrementAuthOidcLoginSuccess,
        incrementAuthOidcLoginFailure,
        incrementAuthOidcLoginPending,
        incrementOfflineLoginAttempt,
        incrementOfflineLoginBlocked,
        incrementRefreshReplayDetected
      }
    }
  };
}

async function expectDomainCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(DomainHttpError);
  await promise.catch((error) => {
    const response = (error as DomainHttpError).getResponse() as { code: string };
    expect(response.code).toBe(code);
  });
}

function buildLoginPayload() {
  return {
    authorization_code: 'code-123',
    code_verifier: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~',
    redirect_uri: 'http://127.0.0.1:53123/callback',
    nonce: 'nonce-12345',
    device_fingerprint: {
      raw_components: {
        machine_id: 'MACHINE-A',
        disk_serial: 'DISK-A'
      }
    }
  };
}

describe('EndUserAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('issues access/refresh/offline tokens on successful OIDC login', async () => {
    const { service, mocks } = createService();

    mocks.fn.endUserFindMany.mockResolvedValue([
      {
        id: 'user-1',
        customerId: 'customer-1',
        identifier: 'user.demo@example.com',
        oidcIssuer: null,
        oidcSubject: null,
        status: 'active'
      }
    ]);

    const result = await service.login('demo-program', buildLoginPayload(), '127.0.0.1');

    expect(result.success).toBe(true);
    expect(result.access_token).toBe('access-token');
    expect(result.refresh_token).toBe('refresh-token');
    expect(result.offline_token).toBe('offline-token');
    expect(result.entitlements).toHaveLength(1);
    expect(result.entitlements[0].program_code).toBe('demo-program');
    expect(mocks.fn.incrementAuthOidcLoginSuccess).toHaveBeenCalledWith('demo-program');
    expect(mocks.fn.incrementOfflineLoginAttempt).toHaveBeenCalledWith('issued');
    expect(mocks.fn.endUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oidcIssuer: 'https://issuer.example.com',
          oidcSubject: 'oidc-subject-1'
        })
      })
    );
  });

  it('denies login for blocked users', async () => {
    const { service, mocks } = createService();

    mocks.fn.endUserFindMany.mockResolvedValue([
      {
        id: 'blocked-user',
        customerId: 'customer-1',
        identifier: 'user.demo@example.com',
        oidcIssuer: null,
        oidcSubject: null,
        status: 'blocked'
      }
    ]);

    await expectDomainCode(service.login('demo-program', buildLoginPayload()), 'user_blocked');
  });

  it('denies login when OIDC identity mismatches a previously bound user', async () => {
    const { service, mocks } = createService();

    mocks.fn.endUserFindMany.mockResolvedValue([
      {
        id: 'user-1',
        customerId: 'customer-1',
        identifier: 'user.demo@example.com',
        oidcIssuer: 'https://issuer.example.com',
        oidcSubject: 'different-subject',
        status: 'active'
      }
    ]);

    await expectDomainCode(service.login('demo-program', buildLoginPayload()), 'invalid_credentials');
  });

  it('denies login when entitlement is not available for program', async () => {
    const { service, mocks } = createService();

    mocks.fn.endUserFindMany.mockResolvedValue([
      {
        id: 'user-1',
        customerId: 'customer-1',
        identifier: 'user.demo@example.com',
        oidcIssuer: null,
        oidcSubject: null,
        status: 'active'
      }
    ]);
    mocks.fn.resolveForProgram.mockResolvedValue(null);

    await expectDomainCode(service.login('extra-program', buildLoginPayload()), 'entitlement_denied');
  });

  it('auto provisions end user on first login and returns access_pending when plan is missing', async () => {
    const { service, mocks } = createService();

    (mocks.appConfig as { endUserAuthAutoProvision: boolean }).endUserAuthAutoProvision = true;
    mocks.fn.resolveForProgram.mockResolvedValue(null);

    await expectDomainCode(service.login('demo-program', buildLoginPayload(), '127.0.0.1'), 'access_pending');

    expect(mocks.fn.customerUpsert).toHaveBeenCalled();
    expect(mocks.fn.endUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oidcIssuer: 'https://issuer.example.com',
          oidcSubject: 'oidc-subject-1'
        })
      })
    );
    expect(mocks.fn.endUserSessionCreate).not.toHaveBeenCalled();
    expect(mocks.fn.incrementAuthOidcLoginPending).toHaveBeenCalledWith('demo-program');
    expect(mocks.fn.authAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'oidc_auto_provisioned'
        })
      })
    );
    expect(mocks.fn.authAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'oidc_login_pending_plan'
        })
      })
    );
  });

  it('auto provisions end user on first login and issues tokens when entitlement exists', async () => {
    const { service, mocks } = createService();

    (mocks.appConfig as { endUserAuthAutoProvision: boolean }).endUserAuthAutoProvision = true;

    const result = await service.login('demo-program', buildLoginPayload(), '127.0.0.1');

    expect(result.success).toBe(true);
    expect(result.offline_token).toBe('offline-token');
    expect(mocks.fn.customerUpsert).toHaveBeenCalled();
    expect(mocks.fn.endUserCreate).toHaveBeenCalled();
    expect(mocks.fn.endUserSessionCreate).toHaveBeenCalled();
    expect(mocks.fn.incrementAuthOidcLoginSuccess).toHaveBeenCalledWith('demo-program');
  });

  it('rotates tokens with refresh token when session is valid', async () => {
    const { service, mocks } = createService();

    const refreshToken = 'refresh-token-valid';
    const refreshTokenHash = hashToken(refreshToken);
    mocks.fn.verifyAsync.mockResolvedValue({
      type: 'refresh',
      sub: 'user-1',
      sid: 'session-1',
      program_id: 'program-1'
    });
    mocks.fn.endUserSessionFindUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      programId: 'program-1',
      deviceFingerprintHash: 'sha256:fingerprint',
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      revokedAt: null
    });
    mocks.fn.endUserFindUnique.mockResolvedValue({
      id: 'user-1',
      customerId: 'customer-1',
      status: 'active'
    });
    mocks.fn.signAsync.mockReset();
    mocks.fn.signAsync.mockResolvedValueOnce('access-token-2').mockResolvedValueOnce('refresh-token-2');

    const result = await service.refresh('demo-program', {
      refresh_token: refreshToken,
      device_fingerprint: {
        raw_components: {
          machine_id: 'MACHINE-A',
          disk_serial: 'DISK-A'
        }
      }
    });

    expect(result.success).toBe(true);
    expect(result.access_token).toBe('access-token-2');
    expect(result.refresh_token).toBe('refresh-token-2');
    expect(result.entitlements).toHaveLength(1);
    expect(mocks.fn.incrementOfflineLoginAttempt).toHaveBeenCalledWith('refreshed');
  });

  it('detects refresh replay and revokes session', async () => {
    const { service, mocks } = createService();

    mocks.fn.verifyAsync.mockResolvedValue({
      type: 'refresh',
      sub: 'user-1',
      sid: 'session-1',
      program_id: 'program-1'
    });
    mocks.fn.endUserSessionFindUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      programId: 'program-1',
      deviceFingerprintHash: 'sha256:fingerprint',
      refreshTokenHash: hashToken('different-refresh-token'),
      expiresAt: new Date(Date.now() + 3600 * 1000),
      revokedAt: null
    });

    await expectDomainCode(
      service.refresh('demo-program', {
        refresh_token: 'refresh-token',
        device_fingerprint: {
          raw_components: {
            machine_id: 'MACHINE-A',
            disk_serial: 'DISK-A'
          }
        }
      }),
      'session_revoked'
    );

    expect(mocks.fn.endUserSessionUpdate).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        revokedAt: expect.any(Date),
        revokeReason: 'refresh_replay'
      }
    });
    expect(mocks.fn.incrementRefreshReplayDetected).toHaveBeenCalledWith('demo-program');
  });
});
