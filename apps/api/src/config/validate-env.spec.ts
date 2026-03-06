import { validateEnv } from './validate-env';

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
      INTERNAL_ADMIN_API_KEYS: 'internal-key-1,internal-key-2'
    });

    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('test');
    expect(env.LICENSE_ENGINE_STRATEGY).toBe('auto');
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
      validateEnv({
        NODE_ENV: 'production',
        PORT: '3001',
        API_PREFIX: '/api/v2',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/sistema_licencas_v2',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'this-is-a-very-long-test-secret-123456',
        INTERNAL_ADMIN_API_KEYS: 'production-internal-key',
        LICENSE_ENGINE_STRATEGY: 'fake'
      })
    ).toThrow('Invalid environment configuration');
  });

  it('throws when production uses default internal admin key', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        PORT: '3001',
        API_PREFIX: '/api/v2',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/sistema_licencas_v2',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'this-is-a-very-long-test-secret-123456',
        LICENSE_ENGINE_STRATEGY: 'auto',
        INTERNAL_ADMIN_API_KEYS: 'dev-internal-admin-key'
      })
    ).toThrow('Invalid environment configuration');
  });
});
