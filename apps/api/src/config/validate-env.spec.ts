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
    INTERNAL_ADMIN_API_KEYS: 'production-internal-key',
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
});
