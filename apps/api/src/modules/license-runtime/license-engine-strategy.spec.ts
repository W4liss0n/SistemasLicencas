import { resolveLicenseEngineStrategy } from './license-engine-strategy';

describe('resolveLicenseEngineStrategy', () => {
  it('resolves auto to fake in test', () => {
    expect(resolveLicenseEngineStrategy('test', 'auto')).toBe('fake');
  });

  it('resolves auto to prisma outside test', () => {
    expect(resolveLicenseEngineStrategy('development', 'auto')).toBe('prisma');
    expect(resolveLicenseEngineStrategy('production', 'auto')).toBe('prisma');
  });

  it('resolves explicit fake outside production', () => {
    expect(resolveLicenseEngineStrategy('test', 'fake')).toBe('fake');
    expect(resolveLicenseEngineStrategy('development', 'fake')).toBe('fake');
  });

  it('resolves explicit prisma in all environments', () => {
    expect(resolveLicenseEngineStrategy('test', 'prisma')).toBe('prisma');
    expect(resolveLicenseEngineStrategy('development', 'prisma')).toBe('prisma');
    expect(resolveLicenseEngineStrategy('production', 'prisma')).toBe('prisma');
  });

  it('throws for fake in production', () => {
    expect(() => resolveLicenseEngineStrategy('production', 'fake')).toThrow(
      'LICENSE_ENGINE_STRATEGY=fake is not allowed in production'
    );
  });
});
