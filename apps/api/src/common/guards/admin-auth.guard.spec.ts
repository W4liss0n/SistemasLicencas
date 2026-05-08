import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainHttpError } from '../errors/domain-http-error';
import { AdminAuthGuard } from './admin-auth.guard';

describe('AdminAuthGuard', () => {
  function buildConfig(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      get adminAuthEnabled(): boolean {
        return Boolean(overrides.adminAuthEnabled);
      },
      get adminAuthIssuerUrl(): string {
        return String(overrides.adminAuthIssuerUrl ?? 'https://tenant.example.auth0.com/');
      },
      get adminAuthAudience(): string {
        return String(overrides.adminAuthAudience ?? 'https://api.example.com/admin');
      },
      get adminAuthRequiredScopes(): string[] {
        return (overrides.adminAuthRequiredScopes as string[] | undefined) ?? ['admin:access'];
      },
      get adminAuthClockToleranceSeconds(): number {
        return Number(overrides.adminAuthClockToleranceSeconds ?? 60);
      }
    };
  }

  function buildContext(authorization?: string): ExecutionContext {
    class Controller {}
    const handler = () => undefined;

    return {
      getClass: () => Controller,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({
          headers: authorization ? { authorization } : {}
        })
      })
    } as unknown as ExecutionContext;
  }

  it('allows requests without token when admin auth is disabled', async () => {
    const guard = new AdminAuthGuard(buildConfig({ adminAuthEnabled: false }) as never, new Reflector());

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });

  it('requires a bearer token when admin auth is enabled', async () => {
    const guard = new AdminAuthGuard(buildConfig({ adminAuthEnabled: true }) as never, new Reflector());

    await expect(guard.canActivate(buildContext())).rejects.toThrow(DomainHttpError);
    await expect(guard.canActivate(buildContext())).rejects.toThrow(
      'Authorization Bearer token is required'
    );
  });

  it('rejects an empty bearer token', async () => {
    const guard = new AdminAuthGuard(buildConfig({ adminAuthEnabled: true }) as never, new Reflector());

    await expect(guard.canActivate(buildContext('Bearer '))).rejects.toThrow(
      'Authorization Bearer token is required'
    );
  });
});
