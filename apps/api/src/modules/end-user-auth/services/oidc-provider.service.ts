import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { AppConfigService } from '../../../config/app-config.service';
import { MetricsService } from '../../../observability/metrics.service';

interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  id_token_signing_alg_values_supported?: string[];
}

interface OidcTokenResponse {
  id_token?: string;
}

export interface OidcIdentity {
  issuer: string;
  subject: string;
  email: string;
  name: string | null;
}

export interface OidcConfigResponse {
  issuer: string;
  client_id: string;
  authorization_endpoint: string;
  token_endpoint: string;
  scopes: string[];
}

@Injectable()
export class OidcProviderService {
  private discoveryCache?: {
    value: OidcDiscoveryDocument;
    expiresAtMs: number;
  };

  private jwksResolverCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

  constructor(
    @Inject(AppConfigService) private readonly configService: AppConfigService,
    @Inject(MetricsService) private readonly metricsService: MetricsService
  ) {}

  async getPublicConfig(): Promise<OidcConfigResponse> {
    const discovery = await this.getDiscovery();
    return {
      issuer: discovery.issuer,
      client_id: this.configService.oidcClientId,
      authorization_endpoint: discovery.authorization_endpoint,
      token_endpoint: discovery.token_endpoint,
      scopes: this.configService.oidcScopes
    };
  }

  async exchangeAuthorizationCode(input: {
    authorizationCode: string;
    codeVerifier: string;
    redirectUri: string;
    nonce: string;
  }): Promise<OidcIdentity> {
    const discovery = await this.getDiscovery();
    const tokenResponse = await this.fetchToken(discovery, input);

    if (!tokenResponse.id_token) {
      this.metricsService.incrementAuthOidcCodeExchangeFailure('missing_id_token');
      throw this.invalidCredentials('OIDC provider did not return id_token');
    }

    const algorithms = discovery.id_token_signing_alg_values_supported?.filter(
      (alg) => alg !== 'none'
    );

    let payload: JWTPayload;
    try {
      const jwks = this.getRemoteJwkSet(discovery.jwks_uri);
      const verified = await jwtVerify(tokenResponse.id_token, jwks, {
        issuer: discovery.issuer,
        audience: this.configService.oidcClientId,
        algorithms: algorithms && algorithms.length > 0 ? algorithms : undefined,
        clockTolerance: this.configService.oidcClockSkewSeconds
      });
      payload = verified.payload;
    } catch {
      this.metricsService.incrementAuthOidcCodeExchangeFailure('invalid_id_token');
      throw this.invalidCredentials('Invalid OIDC id_token');
    }

    if (payload.nonce !== input.nonce) {
      this.metricsService.incrementAuthOidcCodeExchangeFailure('invalid_nonce');
      throw this.invalidCredentials('Invalid OIDC nonce');
    }

    const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';

    if (!subject) {
      throw this.invalidCredentials('OIDC id_token missing sub');
    }

    if (!email) {
      throw this.invalidCredentials('OIDC id_token missing email');
    }

    if (!emailVerified) {
      throw this.invalidCredentials('OIDC email is not verified');
    }

    return {
      issuer: discovery.issuer,
      subject,
      email,
      name: name.length > 0 ? name : null
    };
  }

  private async fetchToken(
    discovery: OidcDiscoveryDocument,
    input: {
      authorizationCode: string;
      codeVerifier: string;
      redirectUri: string;
      nonce: string;
    }
  ): Promise<OidcTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.authorizationCode,
      client_id: this.configService.oidcClientId,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier
    });

    const response = await this.fetchJson<OidcTokenResponse>(
      discovery.token_endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json'
        },
        body
      },
      { trackCodeExchangeFailure: true }
    );

    return response;
  }

  private async getDiscovery(): Promise<OidcDiscoveryDocument> {
    const nowMs = Date.now();
    if (this.discoveryCache && this.discoveryCache.expiresAtMs > nowMs) {
      return this.discoveryCache.value;
    }

    const issuer = this.configService.oidcIssuerUrl.replace(/\/$/, '');
    const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
    const discovery = await this.fetchJson<OidcDiscoveryDocument>(discoveryUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    if (
      typeof discovery.issuer !== 'string' ||
      typeof discovery.authorization_endpoint !== 'string' ||
      typeof discovery.token_endpoint !== 'string' ||
      typeof discovery.jwks_uri !== 'string'
    ) {
      throw this.invalidRequest('OIDC discovery document is invalid');
    }

    this.discoveryCache = {
      value: discovery,
      expiresAtMs: nowMs + 5 * 60 * 1000
    };

    return discovery;
  }

  private getRemoteJwkSet(jwksUri: string): ReturnType<typeof createRemoteJWKSet> {
    const cached = this.jwksResolverCache.get(jwksUri);
    if (cached) {
      return cached;
    }

    const jwks = createRemoteJWKSet(new URL(jwksUri), {
      timeoutDuration: this.configService.oidcHttpTimeoutMs
    });

    this.jwksResolverCache.set(jwksUri, jwks);
    return jwks;
  }

  private async fetchJson<T>(
    url: string,
    init: RequestInit,
    options?: { trackCodeExchangeFailure?: boolean }
  ): Promise<T> {
    const shouldTrackCodeExchangeFailure = options?.trackCodeExchangeFailure ?? false;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.configService.oidcHttpTimeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: abortController.signal
      });

      if (!response.ok) {
        if (shouldTrackCodeExchangeFailure) {
          this.metricsService.incrementAuthOidcCodeExchangeFailure(`http_${response.status}`);
        }
        throw this.invalidCredentials(`OIDC request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as T;
      return payload;
    } catch (error) {
      if (error instanceof DomainHttpError) {
        throw error;
      }

      if (shouldTrackCodeExchangeFailure) {
        this.metricsService.incrementAuthOidcCodeExchangeFailure('transport_error');
      }
      throw this.invalidCredentials('OIDC request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private invalidCredentials(detail: string): DomainHttpError {
    return new DomainHttpError({
      status: HttpStatus.UNAUTHORIZED,
      code: 'invalid_credentials',
      detail,
      title: 'Invalid credentials'
    });
  }

  private invalidRequest(detail: string): DomainHttpError {
    return new DomainHttpError({
      status: HttpStatus.BAD_REQUEST,
      code: 'invalid_request',
      detail,
      title: 'Invalid request'
    });
  }
}
