import { z } from 'zod';

const booleanEnv = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return value;
}, z.boolean());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  API_PREFIX: z.string().min(1).default('/api/v2'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ACCESS_JWT_SECRET: z.string().min(32).optional(),
  REFRESH_JWT_SECRET: z.string().min(32).optional(),
  OFFLINE_JWT_PRIVATE_KEY_PEM: z.string().min(32).optional(),
  OFFLINE_JWT_PUBLIC_KEY_PEM: z.string().min(32).optional(),
  OFFLINE_JWT_KID: z.string().min(3).default('offline-key-v1'),
  OFFLINE_MAX_HOURS: z.coerce.number().int().positive().default(72),
  CLOCK_SKEW_SECONDS: z.coerce.number().int().nonnegative().default(120),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  ACCESS_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  END_USER_AUTH_ENABLED: booleanEnv.default(false),
  END_USER_AUTH_AUTO_PROVISION: booleanEnv.default(false),
  OIDC_ISSUER_URL: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().min(1).optional(),
  OIDC_SCOPES: z.string().min(1).default('openid profile email'),
  OIDC_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  OIDC_CLOCK_SKEW_SECONDS: z.coerce.number().int().nonnegative().default(120),
  AUTH_PASSWORD_PEPPER: z.string().min(16).default('change-me-auth-pepper-please'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().positive().default(24),
  LICENSE_ENGINE_STRATEGY: z.enum(['auto', 'fake', 'prisma']).default('auto'),
  INTERNAL_ADMIN_API_KEYS: z.string().min(1).default('dev-internal-admin-key'),
  OTEL_ENABLED: booleanEnv.default(false),
  OTEL_SERVICE_NAME: z.string().min(1).default('sistema-licencas-v2'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  METRICS_ENABLED: booleanEnv.default(false),
  METRICS_PATH: z.string().min(1).default('/metrics')
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && value.LICENSE_ENGINE_STRATEGY === 'fake') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['LICENSE_ENGINE_STRATEGY'],
      message: 'fake is not allowed when NODE_ENV=production'
    });
  }

  const internalAdminKeys = value.INTERNAL_ADMIN_API_KEYS.split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (internalAdminKeys.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['INTERNAL_ADMIN_API_KEYS'],
      message: 'at least one internal admin key must be provided'
    });
  }

  if (value.NODE_ENV === 'production' && internalAdminKeys.includes('dev-internal-admin-key')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['INTERNAL_ADMIN_API_KEYS'],
      message: 'default internal admin key is not allowed in production'
    });
  }

  if (value.END_USER_AUTH_ENABLED) {
    if (!value.OIDC_ISSUER_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OIDC_ISSUER_URL'],
        message: 'OIDC_ISSUER_URL is required when END_USER_AUTH_ENABLED=true'
      });
    }

    if (!value.OIDC_CLIENT_ID) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OIDC_CLIENT_ID'],
        message: 'OIDC_CLIENT_ID is required when END_USER_AUTH_ENABLED=true'
      });
    }

    if (!value.OFFLINE_JWT_PRIVATE_KEY_PEM) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OFFLINE_JWT_PRIVATE_KEY_PEM'],
        message: 'OFFLINE_JWT_PRIVATE_KEY_PEM is required when END_USER_AUTH_ENABLED=true'
      });
    }

    if (!value.OFFLINE_JWT_PUBLIC_KEY_PEM) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OFFLINE_JWT_PUBLIC_KEY_PEM'],
        message: 'OFFLINE_JWT_PUBLIC_KEY_PEM is required when END_USER_AUTH_ENABLED=true'
      });
    }
  }
});

export type AppEnv = z.infer<typeof envSchema>;
