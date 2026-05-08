import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { AppConfigService } from '../../config/app-config.service';
import { DomainHttpError } from '../errors/domain-http-error';
import { ADMIN_AUTH_SCOPES_KEY } from './admin-auth-scopes.decorator';

type AdminAuthRequest = {
  headers: Record<string, string | string[] | undefined>;
  adminAuth?: {
    subject: string | null;
    scopes: string[];
    permissions: string[];
    claims: JWTPayload;
  };
};

type Auth0Claims = JWTPayload & {
  scope?: unknown;
  permissions?: unknown;
};

@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

  constructor(
    private readonly configService: AppConfigService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.configService.adminAuthEnabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AdminAuthRequest>();
    const token = this.extractBearerToken(request.headers.authorization);
    const payload = await this.verifyAccessToken(token);
    const requiredScopes = this.resolveRequiredScopes(context);
    const grantedScopes = this.collectGrantedScopes(payload);

    for (const scope of requiredScopes) {
      if (!grantedScopes.has(scope)) {
        throw new DomainHttpError({
          code: 'admin_auth_forbidden',
          detail: `Auth0 access token is missing required scope: ${scope}`,
          status: HttpStatus.FORBIDDEN,
          title: 'Forbidden admin request'
        });
      }
    }

    request.adminAuth = {
      subject: typeof payload.sub === 'string' ? payload.sub : null,
      scopes: this.readScopeClaim(payload),
      permissions: this.readPermissionsClaim(payload),
      claims: payload
    };

    return true;
  }

  private extractBearerToken(header: string | string[] | undefined): string {
    const value = Array.isArray(header) ? header[0] : header;
    const normalized = value?.trim() ?? '';

    if (!normalized.toLowerCase().startsWith('bearer ')) {
      throw new DomainHttpError({
        code: 'admin_auth_required',
        detail: 'Authorization Bearer token is required',
        status: HttpStatus.UNAUTHORIZED,
        title: 'Unauthorized admin request'
      });
    }

    const token = normalized.slice('bearer '.length).trim();
    if (!token) {
      throw new DomainHttpError({
        code: 'admin_auth_required',
        detail: 'Authorization Bearer token is required',
        status: HttpStatus.UNAUTHORIZED,
        title: 'Unauthorized admin request'
      });
    }

    return token;
  }

  private async verifyAccessToken(token: string): Promise<Auth0Claims> {
    const issuer = this.configService.adminAuthIssuerUrl;
    const audience = this.configService.adminAuthAudience;

    if (!issuer || !audience) {
      throw new DomainHttpError({
        code: 'admin_auth_misconfigured',
        detail: 'Admin Auth0 issuer and audience must be configured',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        title: 'Admin auth is misconfigured'
      });
    }

    try {
      const { payload } = await jwtVerify(token, this.getJwks(issuer), {
        algorithms: ['RS256'],
        audience,
        clockTolerance: this.configService.adminAuthClockToleranceSeconds,
        issuer
      });
      return payload as Auth0Claims;
    } catch {
      throw new DomainHttpError({
        code: 'admin_auth_invalid_token',
        detail: 'Auth0 access token is invalid',
        status: HttpStatus.UNAUTHORIZED,
        title: 'Unauthorized admin request'
      });
    }
  }

  private getJwks(issuer: string): ReturnType<typeof createRemoteJWKSet> {
    const cached = this.jwksByIssuer.get(issuer);
    if (cached) {
      return cached;
    }

    const jwks = createRemoteJWKSet(new URL('.well-known/jwks.json', issuer));
    this.jwksByIssuer.set(issuer, jwks);
    return jwks;
  }

  private resolveRequiredScopes(context: ExecutionContext): string[] {
    const metadataScopes = this.reflector.getAllAndOverride<string[] | undefined>(
      ADMIN_AUTH_SCOPES_KEY,
      [context.getHandler(), context.getClass()]
    );

    return metadataScopes && metadataScopes.length > 0
      ? metadataScopes
      : this.configService.adminAuthRequiredScopes;
  }

  private collectGrantedScopes(payload: Auth0Claims): Set<string> {
    return new Set([...this.readScopeClaim(payload), ...this.readPermissionsClaim(payload)]);
  }

  private readScopeClaim(payload: Auth0Claims): string[] {
    return typeof payload.scope === 'string'
      ? payload.scope
          .split(/\s+/)
          .map((scope) => scope.trim())
          .filter((scope) => scope.length > 0)
      : [];
  }

  private readPermissionsClaim(payload: Auth0Claims): string[] {
    return Array.isArray(payload.permissions)
      ? payload.permissions.filter((permission): permission is string => typeof permission === 'string')
      : [];
  }
}
