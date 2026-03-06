import type { ExecutionContext } from '@nestjs/common';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { InternalApiKeyGuard } from './internal-api-key.guard';

describe('InternalApiKeyGuard', () => {
  const configService = {
    get internalAdminApiKeys(): string[] {
      return ['internal-key-1', 'internal-key-2'];
    }
  };

  const guard = new InternalApiKeyGuard(configService as never);

  function buildContext(headerValue?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: headerValue
            ? { 'x-internal-api-key': headerValue }
            : {}
        })
      })
    } as ExecutionContext;
  }

  it('allows request when internal key is valid', () => {
    expect(guard.canActivate(buildContext('internal-key-2'))).toBe(true);
  });

  it('throws unauthorized when header is missing', () => {
    expect(() => guard.canActivate(buildContext())).toThrow(DomainHttpError);
    expect(() => guard.canActivate(buildContext())).toThrow('Header X-Internal-Api-Key is required');
  });

  it('throws unauthorized when key is invalid', () => {
    expect(() => guard.canActivate(buildContext('invalid-key'))).toThrow(DomainHttpError);
    expect(() => guard.canActivate(buildContext('invalid-key'))).toThrow('Invalid internal admin key');
  });
});
