import type { AppEnv } from '../../config/env.schema';

export type LicenseEngineStrategy = AppEnv['LICENSE_ENGINE_STRATEGY'];
export type ResolvedLicenseEngine = 'fake' | 'prisma';

export function resolveLicenseEngineStrategy(
  nodeEnv: AppEnv['NODE_ENV'],
  strategy: LicenseEngineStrategy
): ResolvedLicenseEngine {
  if (nodeEnv === 'production' && strategy === 'fake') {
    throw new Error(
      'Invalid license engine configuration: LICENSE_ENGINE_STRATEGY=fake is not allowed in production.'
    );
  }

  if (strategy === 'fake') {
    return 'fake';
  }

  if (strategy === 'prisma') {
    return 'prisma';
  }

  return nodeEnv === 'test' ? 'fake' : 'prisma';
}
