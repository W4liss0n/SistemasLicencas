import { validateEnv } from './validate-env';

function baseProductionEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: 'production',
    PORT: '3001',
    API_PREFIX: '/api/v2',
    DATABASE_URL:
      'postgresql://postgres:strong-prod-password@localhost:5432/sistema_licencas_v2',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'this-is-a-very-long-production-secret-123456',
    ACCESS_JWT_SECRET: 'this-is-a-very-long-access-secret-123456',
    REFRESH_JWT_SECRET: 'this-is-a-very-long-refresh-secret-123456',
    AUTH_PASSWORD_PEPPER: 'this-is-a-very-long-prod-pepper-123456',
    INTERNAL_ADMIN_API_KEYS: 'production-internal-key-with-32-characters',
    CORS_ALLOWED_ORIGINS: 'https://admin.example.com',
    LICENSE_ENGINE_STRATEGY: 'auto',
    ...overrides
  };
}

describe('validateEnv', () => {
  it('parses valid environment', () => {
    const env = validateEnv({
      NODE_ENV: 'test',
      PORT: '3001',
      API_PREFIX: '/api/v2',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/sistema_licencas_v2',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'this-is-a-very-long-test-secret-123456',
      REQUEST_TIMEOUT_MS: '2500',
      IDEMPOTENCY_TTL_HOURS: '24',
      LICENSE_ENGINE_STRATEGY: 'auto',
      INTERNAL_ADMIN_API_KEYS: 'internal-key-1,internal-key-2',
      CORS_ALLOWED_ORIGINS: 'http://localhost:4173, http://localhost:4173/'
    });

    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('test');
    expect(env.LICENSE_ENGINE_STRATEGY).toBe('auto');
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:4173']);
  });

  it('throws on invalid environment', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/sistema_licencas_v2'
      })
    ).toThrow('Invalid environment configuration');
  });

  it('throws when production uses fake license engine strategy', () => {
    expect(() =>
      validateEnv(
        baseProductionEnv({
          LICENSE_ENGINE_STRATEGY: 'fake'
        })
      )
    ).toThrow('Invalid environment configuration');
  });

  it('throws when production uses default internal admin key', () => {
    expect(() =>
      validateEnv(
        baseProductionEnv({
          INTERNAL_ADMIN_API_KEYS: 'dev-internal-admin-key'
        })
      )
    ).toThrow('Invalid environment configuration');
  });

  it.each(['short-internal-key', 'replace-with-internal-admin-key', 'dev_internal_admin_key_with_32_chars'])(
    'throws when production uses weak internal admin key %s',
    (INTERNAL_ADMIN_API_KEYS) => {
      expect(() =>
        validateEnv(
          baseProductionEnv({
            INTERNAL_ADMIN_API_KEYS
          })
        )
      ).toThrow('Invalid environment configuration');
    }
  );

  it('throws when production does not declare a CORS allowlist', () => {
    expect(() =>
      validateEnv(
        baseProductionEnv({
          CORS_ALLOWED_ORIGINS: ''
        })
      )
    ).toThrow('Invalid environment configuration');
  });

  it('throws when production CORS uses wildcard or http origins', () => {
    expect(() =>
      validateEnv(
        baseProductionEnv({
          CORS_ALLOWED_ORIGINS: '*, http://admin.example.com'
        })
      )
    ).toThrow('Invalid environment configuration');
  });

  it('throws when production keeps placeholder secrets or postgres password', () => {
    expect(() =>
      validateEnv(
        baseProductionEnv({
          DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/sistema_licencas_v2',
          JWT_SECRET: 'change-me-at-least-32-characters',
          AUTH_PASSWORD_PEPPER: 'change-me-auth-pepper-please'
        })
      )
    ).toThrow('Invalid environment configuration');
  });

  it('throws when production omits access or refresh token secrets', () => {
    const env = baseProductionEnv();
    delete env.ACCESS_JWT_SECRET;
    delete env.REFRESH_JWT_SECRET;

    expect(() => validateEnv(env)).toThrow('Invalid environment configuration');
  });

  it('throws when production token secrets reuse the same value', () => {
    expect(() =>
      validateEnv(
        baseProductionEnv({
          ACCESS_JWT_SECRET: 'this-is-a-very-long-production-secret-123456',
          REFRESH_JWT_SECRET: 'this-is-a-very-long-production-secret-123456'
        })
      )
    ).toThrow('Invalid environment configuration');
  });

  it('requires Auth0 issuer and audience when admin auth is enabled', () => {
    expect(() =>
      validateEnv(
        baseProductionEnv({
          ADMIN_AUTH_ENABLED: 'true',
          ADMIN_AUTH_REQUIRED_SCOPES: 'admin:access'
        })
      )
    ).toThrow('Invalid environment configuration');
  });

  it('allows blank Auth0 issuer and audience when admin auth is disabled', () => {
    const env = validateEnv(
      baseProductionEnv({
        ADMIN_AUTH_ENABLED: 'false',
        ADMIN_AUTH_ISSUER_URL: '',
        ADMIN_AUTH_AUDIENCE: ''
      })
    );

    expect(env.ADMIN_AUTH_ENABLED).toBe(false);
    expect(env.ADMIN_AUTH_ISSUER_URL).toBeUndefined();
    expect(env.ADMIN_AUTH_AUDIENCE).toBeUndefined();
  });

  it.each([' ', ',', ' ,  , '])(
    'rejects empty admin scope lists when admin auth is enabled',
    (ADMIN_AUTH_REQUIRED_SCOPES) => {
      expect(() =>
        validateEnv(
          baseProductionEnv({
            ADMIN_AUTH_ENABLED: 'true',
            ADMIN_AUTH_ISSUER_URL: 'https://tenant.example.auth0.com/',
            ADMIN_AUTH_AUDIENCE: 'https://api.example.com/admin',
            ADMIN_AUTH_REQUIRED_SCOPES
          })
        )
      ).toThrow('Invalid environment configuration');
    }
  );

  it('parses admin auth config when enabled', () => {
    const env = validateEnv(
      baseProductionEnv({
        ADMIN_AUTH_ENABLED: 'true',
        ADMIN_AUTH_ISSUER_URL: 'https://tenant.example.auth0.com/',
        ADMIN_AUTH_AUDIENCE: 'https://api.example.com/admin',
        ADMIN_AUTH_REQUIRED_SCOPES: 'admin:access licenses:read',
        ADMIN_AUTH_CLOCK_TOLERANCE_SECONDS: '30'
      })
    );

    expect(env.ADMIN_AUTH_ENABLED).toBe(true);
    expect(env.ADMIN_AUTH_ISSUER_URL).toBe('https://tenant.example.auth0.com/');
    expect(env.ADMIN_AUTH_AUDIENCE).toBe('https://api.example.com/admin');
    expect(env.ADMIN_AUTH_CLOCK_TOLERANCE_SECONDS).toBe(30);
  });
});
