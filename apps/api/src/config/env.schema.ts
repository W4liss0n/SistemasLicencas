import { z } from 'zod';
import { parseAdminAuthRequiredScopes } from './admin-auth-scopes';

const PRODUCTION_INTERNAL_ADMIN_KEY_MIN_LENGTH = 32;

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

const optionalUrlEnv = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim().length === 0) {
    return undefined;
  }

  return value;
}, z.string().url().optional());

const optionalNonEmptyStringEnv = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim().length === 0) {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

const corsAllowedOriginsEnv = z
  .preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }, z.array(z.string()).default([]))
  .transform((origins, context) => {
    const normalizedOrigins = new Set<string>();

    for (const origin of origins) {
      if (origin === '*') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'wildcard origin is not allowed'
        });
        continue;
      }

      try {
        const parsed = new URL(origin);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${origin} must use http or https`
          });
          continue;
        }

        normalizedOrigins.add(parsed.origin);
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${origin} must be a valid URL origin`
        });
      }
    }

    return Array.from(normalizedOrigins);
  });

function isPlaceholderSecret(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith('change-me') ||
    normalized.startsWith('replace-with') ||
    normalized.startsWith('dev_') ||
    normalized.startsWith('dev-') ||
    normalized === 'change-me-auth-pepper-please'
  );
}

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
  ADMIN_AUTH_ENABLED: booleanEnv.default(false),
  ADMIN_AUTH_ISSUER_URL: optionalUrlEnv,
  ADMIN_AUTH_AUDIENCE: optionalNonEmptyStringEnv,
  ADMIN_AUTH_REQUIRED_SCOPES: z.string().min(1).default('admin:access'),
  ADMIN_AUTH_CLOCK_TOLERANCE_SECONDS: z.coerce.number().int().nonnegative().default(60),
  AUTH_PASSWORD_PEPPER: z.string().min(16).default('change-me-auth-pepper-please'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().positive().default(24),
  LICENSE_ENGINE_STRATEGY: z.enum(['auto', 'fake', 'prisma']).default('auto'),
  INTERNAL_ADMIN_API_KEYS: z.string().min(1).default('dev-internal-admin-key'),
  CORS_ALLOWED_ORIGINS: corsAllowedOriginsEnv,
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

  if (value.NODE_ENV === 'production' && value.CORS_ALLOWED_ORIGINS.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ALLOWED_ORIGINS'],
      message: 'CORS_ALLOWED_ORIGINS is required in production'
    });
  }

  if (
    value.NODE_ENV === 'production' &&
    value.CORS_ALLOWED_ORIGINS.some((origin) => !origin.startsWith('https://'))
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ALLOWED_ORIGINS'],
      message: 'production CORS origins must use https'
    });
  }

  if (value.NODE_ENV === 'production' && value.DATABASE_URL.includes(':postgres@')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DATABASE_URL'],
      message: 'default postgres password is not allowed in production DATABASE_URL'
    });
  }

  if (value.NODE_ENV === 'production') {
    for (const key of ['ACCESS_JWT_SECRET', 'REFRESH_JWT_SECRET'] as const) {
      if (!value[key]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required in production`
        });
      }
    }

    if (value.ACCESS_JWT_SECRET && value.ACCESS_JWT_SECRET === value.JWT_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ACCESS_JWT_SECRET'],
        message: 'ACCESS_JWT_SECRET must be different from JWT_SECRET in production'
      });
    }

    if (value.REFRESH_JWT_SECRET && value.REFRESH_JWT_SECRET === value.JWT_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REFRESH_JWT_SECRET'],
        message: 'REFRESH_JWT_SECRET must be different from JWT_SECRET in production'
      });
    }

    if (
      value.ACCESS_JWT_SECRET &&
      value.REFRESH_JWT_SECRET &&
      value.ACCESS_JWT_SECRET === value.REFRESH_JWT_SECRET
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REFRESH_JWT_SECRET'],
        message: 'REFRESH_JWT_SECRET must be different from ACCESS_JWT_SECRET in production'
      });
    }
  }

  for (const key of [
    'JWT_SECRET',
    'ACCESS_JWT_SECRET',
    'REFRESH_JWT_SECRET',
    'AUTH_PASSWORD_PEPPER'
  ] as const) {
    if (value.NODE_ENV === 'production' && isPlaceholderSecret(value[key])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: 'placeholder secret is not allowed in production'
      });
    }
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

  if (value.NODE_ENV === 'production') {
    for (const key of internalAdminKeys) {
      if (key.length < PRODUCTION_INTERNAL_ADMIN_KEY_MIN_LENGTH) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['INTERNAL_ADMIN_API_KEYS'],
          message: `internal admin keys must be at least ${PRODUCTION_INTERNAL_ADMIN_KEY_MIN_LENGTH} characters in production`
        });
      }

      if (isPlaceholderSecret(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['INTERNAL_ADMIN_API_KEYS'],
          message: 'placeholder internal admin keys are not allowed in production'
        });
      }
    }
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

  if (value.ADMIN_AUTH_ENABLED) {
    if (!value.ADMIN_AUTH_ISSUER_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_AUTH_ISSUER_URL'],
        message: 'ADMIN_AUTH_ISSUER_URL is required when ADMIN_AUTH_ENABLED=true'
      });
    }

    if (!value.ADMIN_AUTH_AUDIENCE) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_AUTH_AUDIENCE'],
        message: 'ADMIN_AUTH_AUDIENCE is required when ADMIN_AUTH_ENABLED=true'
      });
    }

    if (parseAdminAuthRequiredScopes(value.ADMIN_AUTH_REQUIRED_SCOPES).length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_AUTH_REQUIRED_SCOPES'],
        message: 'ADMIN_AUTH_REQUIRED_SCOPES must include at least one scope when ADMIN_AUTH_ENABLED=true'
      });
    }
  }
});

export type AppEnv = z.infer<typeof envSchema>;
