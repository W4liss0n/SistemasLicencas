import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from './env.schema';

@Injectable()
export class AppConfigService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<AppEnv, true>
  ) {}

  get nodeEnv(): AppEnv['NODE_ENV'] {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.configService.get('PORT', { infer: true });
  }

  get apiPrefix(): string {
    return this.configService.get('API_PREFIX', { infer: true });
  }

  get databaseUrl(): string {
    return this.configService.get('DATABASE_URL', { infer: true });
  }

  get redisUrl(): string {
    return this.configService.get('REDIS_URL', { infer: true });
  }

  get jwtSecret(): string {
    return this.configService.get('JWT_SECRET', { infer: true });
  }

  get accessJwtSecret(): string {
    return this.configService.get('ACCESS_JWT_SECRET', { infer: true }) ?? this.jwtSecret;
  }

  get refreshJwtSecret(): string {
    return this.configService.get('REFRESH_JWT_SECRET', { infer: true }) ?? this.jwtSecret;
  }

  get offlineJwtPrivateKeyPem(): string | undefined {
    const value = this.configService.get('OFFLINE_JWT_PRIVATE_KEY_PEM', { infer: true });
    return value ? value.replace(/\\n/g, '\n') : undefined;
  }

  get offlineJwtPublicKeyPem(): string | undefined {
    const value = this.configService.get('OFFLINE_JWT_PUBLIC_KEY_PEM', { infer: true });
    return value ? value.replace(/\\n/g, '\n') : undefined;
  }

  get offlineJwtKid(): string {
    return this.configService.get('OFFLINE_JWT_KID', { infer: true });
  }

  get offlineMaxHours(): number {
    return this.configService.get('OFFLINE_MAX_HOURS', { infer: true });
  }

  get clockSkewSeconds(): number {
    return this.configService.get('CLOCK_SKEW_SECONDS', { infer: true });
  }

  get refreshTtlDays(): number {
    return this.configService.get('REFRESH_TTL_DAYS', { infer: true });
  }

  get accessTtlMinutes(): number {
    return this.configService.get('ACCESS_TTL_MINUTES', { infer: true });
  }

  get endUserAuthEnabled(): boolean {
    return this.configService.get('END_USER_AUTH_ENABLED', { infer: true });
  }

  get endUserAuthAutoProvision(): boolean {
    return this.configService.get('END_USER_AUTH_AUTO_PROVISION', { infer: true });
  }

  get oidcIssuerUrl(): string {
    return this.configService.get('OIDC_ISSUER_URL', { infer: true }) ?? '';
  }

  get oidcClientId(): string {
    return this.configService.get('OIDC_CLIENT_ID', { infer: true }) ?? '';
  }

  get oidcScopes(): string[] {
    const raw = this.configService.get('OIDC_SCOPES', { infer: true });
    return raw
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0);
  }

  get oidcHttpTimeoutMs(): number {
    return this.configService.get('OIDC_HTTP_TIMEOUT_MS', { infer: true });
  }

  get oidcClockSkewSeconds(): number {
    return this.configService.get('OIDC_CLOCK_SKEW_SECONDS', { infer: true });
  }

  get authPasswordPepper(): string {
    return this.configService.get('AUTH_PASSWORD_PEPPER', { infer: true });
  }

  get requestTimeoutMs(): number {
    return this.configService.get('REQUEST_TIMEOUT_MS', { infer: true });
  }

  get idempotencyTtlHours(): number {
    return this.configService.get('IDEMPOTENCY_TTL_HOURS', { infer: true });
  }

  get licenseEngineStrategy(): AppEnv['LICENSE_ENGINE_STRATEGY'] {
    return this.configService.get('LICENSE_ENGINE_STRATEGY', { infer: true });
  }

  get internalAdminApiKeys(): string[] {
    const raw = this.configService.get('INTERNAL_ADMIN_API_KEYS', { infer: true });
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  get otelEnabled(): boolean {
    return this.configService.get('OTEL_ENABLED', { infer: true });
  }

  get otelServiceName(): string {
    return this.configService.get('OTEL_SERVICE_NAME', { infer: true });
  }

  get otelExporterOtlpEndpoint(): string | undefined {
    return this.configService.get('OTEL_EXPORTER_OTLP_ENDPOINT', { infer: true });
  }

  get metricsEnabled(): boolean {
    return this.configService.get('METRICS_ENABLED', { infer: true });
  }

  get metricsPath(): string {
    return this.configService.get('METRICS_PATH', { infer: true });
  }
}
