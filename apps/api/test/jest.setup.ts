process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PORT = process.env.PORT ?? '3999';
process.env.API_PREFIX = process.env.API_PREFIX ?? '/api/v2';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/sistema_licencas_v2';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-with-32-characters-minimum';
process.env.ACCESS_JWT_SECRET =
  process.env.ACCESS_JWT_SECRET ?? 'test-access-secret-with-32-characters-minimum';
process.env.REFRESH_JWT_SECRET =
  process.env.REFRESH_JWT_SECRET ?? 'test-refresh-secret-with-32-characters-minimum';
process.env.OFFLINE_JWT_PRIVATE_KEY_PEM =
  process.env.OFFLINE_JWT_PRIVATE_KEY_PEM ??
  '-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC/6RABRECAPgXN\\n4Uh+2rnvywFl/tkWDKPF8wWqJpuBk8bEFkgUk8XkKcqt78nC8TGwgIiNybfyyDzD\\nluWAv9LWaOQxmYSZUrs0OmnXJrZWhLfTsD8uuheqidlAoerr8VZknEZPU9hhpJMb\\n+PAaMQ0+SmN6xodJF34ZM0+QqitX2gMZgeliNJOnlOUoSD2oKlpaUtm3zrt5/pU3\\nRDmIaBo43ek6GIkVyyNyMSYA/4x7Gn+oja3hKOLIHPoYnrlRm7qqYeSSKzIZkaCT\\nQOK0xLPnTS1jHbHZ8t4qyUiP1YKGXCYBoC+Fd0kW6RHGFtMRVOPp+Z5l1u5EKoVq\\n4pPqtIftAgMBAAECggEAAMeLBw5KGPMEzFv5KK2ZlFW2KX/n5wvWo6aoT9jLaTaQ\\nklLyKIuUl9POMtaSrSUQpVvOsFniJoqBdp5sJyeeePbljrghQ5Zx/hB4jxhPUJGW\\nxdZ3hYPoS7NMsKsZhS7sqBAoM2hPwm+2EnODZ9tBsJXHekIrK0VjV4q34cUJ6cWV\\nf8ouF6T66MgROt5pMBWYSZhHgQSuF7DGOWYVEh5+SQCmRPF7kkwp29MDuKGm6tu1\\nRMq01ftFHmRB/Tmwx1+0wTLKckF6sLfsAFh1kjtbcoST8rLu22kBJH+Vl6C7mOyT\\nTC9lZiuhsBL/RyUIImrYPT06biJg0R4NJKKSOQ6HGwKBgQDjJTQJvo3guQvYTHfa\\nravLQGyfcHtTyZQTIJsNxWw9leQVo1aK+7DEJ+exRJac2BzJLwKQC3iXjCcKqZYt\\nL0dFjp7qfZn3CmeQMEYBnMU86rDL/rLAihUlEfoTtqM+ZGit69syx+b1bRXSkF6c\\ncLvNfcvIJWm38/xTGMcj3WLL2wKBgQDYSgPEvflly93gv789o+nm49Oq1NN4XoIV\\nfk1TvbAIJvmXsYpHvCKoZM02CqbyzPB7zx7agt0qWjIMZe4fiJcwKVjXP4vF75gN\\nvSVpvL5AcGuuRVSor9tSq2EcTHhvTQyau1FKwW+nflsB6DjRQSUy+WEV6c611+zu\\nyuaqSuPp1wKBgFkXWX7M78cJrXysGYJ7BdvVrAUpUCX/9YU/D7HqEldheDGIfERN\\nDfsSD802ssBX/4plVuL6rNT8EsAa3h1g4tqEYw5kL0R3H0GtvXeabr5C6w9IGgJs\\n5nhAwc6Dnym0pl45GSOkxpDStXF+UK2Zhf/GbGxXSEzvdLN/D3Sgu8RrAoGBAJhB\\n6ks6jPGbRTNs6DyFQihWo2/z6HYo2Zw10EuuEdh7T2L5CWYcS62NYGS1tPbhTD1r\\n/cVHMFgbLHZL3wh1yDCQOsk0I7oQQ1MQnuDDjI6iVTtV9RXWzidxG6inMHTxoXjf\\neoeMioQ3T+uUxUKRgJVUtoKNmAWs3k7vqNeiZrT7AoGBANJ9xXUH21BBVMPZN4MO\\nLhZXym8GeNXOZIf8kmRLjUlulvVNM4UeExDyfA1SwGQ2DcuCgUjoYLF8Q8Cwj6mV\\nWTlfJZNwYpoPNiNjgXO4iqffEa6thyqhSwoVLHoiUGg2SLd6WnyH3oHVyuSs7SvG\\nLKRI2jvNEpU9z5uo1s6r8H7v\\n-----END PRIVATE KEY-----\\n';
process.env.OFFLINE_JWT_PUBLIC_KEY_PEM =
  process.env.OFFLINE_JWT_PUBLIC_KEY_PEM ??
  '-----BEGIN PUBLIC KEY-----\\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv+kQAURAgD4FzeFIftq5\\n78sBZf7ZFgyjxfMFqiabgZPGxBZIFJPF5CnKre/JwvExsICIjcm38sg8w5blgL/S\\n1mjkMZmEmVK7NDpp1ya2VoS307A/LroXqonZQKHq6/FWZJxGT1PYYaSTG/jwGjEN\\nPkpjesaHSRd+GTNPkKorV9oDGYHpYjSTp5TlKEg9qCpaWlLZt867ef6VN0Q5iGga\\nON3pOhiJFcsjcjEmAP+Mexp/qI2t4SjiyBz6GJ65UZu6qmHkkisyGZGgk0DitMSz\\n500tYx2x2fLeKslIj9WChlwmAaAvhXdJFukRxhbTEVTj6fmeZdbuRCqFauKT6rSH\\n7QIDAQAB\\n-----END PUBLIC KEY-----\\n';
process.env.OFFLINE_JWT_KID = process.env.OFFLINE_JWT_KID ?? 'test-offline-key-v1';
process.env.OFFLINE_MAX_HOURS = process.env.OFFLINE_MAX_HOURS ?? '72';
process.env.CLOCK_SKEW_SECONDS = process.env.CLOCK_SKEW_SECONDS ?? '120';
process.env.REFRESH_TTL_DAYS = process.env.REFRESH_TTL_DAYS ?? '7';
process.env.ACCESS_TTL_MINUTES = process.env.ACCESS_TTL_MINUTES ?? '15';
process.env.END_USER_AUTH_ENABLED = process.env.END_USER_AUTH_ENABLED ?? 'true';
process.env.OIDC_ISSUER_URL = process.env.OIDC_ISSUER_URL ?? 'https://issuer.example.test';
process.env.OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID ?? 'launcher-client-test';
process.env.OIDC_SCOPES = process.env.OIDC_SCOPES ?? 'openid profile email';
process.env.OIDC_HTTP_TIMEOUT_MS = process.env.OIDC_HTTP_TIMEOUT_MS ?? '3000';
process.env.OIDC_CLOCK_SKEW_SECONDS = process.env.OIDC_CLOCK_SKEW_SECONDS ?? '120';
process.env.AUTH_PASSWORD_PEPPER =
  process.env.AUTH_PASSWORD_PEPPER ?? 'test-auth-pepper-with-32-characters';
process.env.INTERNAL_ADMIN_API_KEYS = 'dev-internal-admin-key';
process.env.REQUEST_TIMEOUT_MS = process.env.REQUEST_TIMEOUT_MS ?? '3000';
process.env.IDEMPOTENCY_TTL_HOURS = process.env.IDEMPOTENCY_TTL_HOURS ?? '24';
process.env.LICENSE_ENGINE_STRATEGY = process.env.LICENSE_ENGINE_STRATEGY ?? 'auto';
process.env.OTEL_ENABLED = process.env.OTEL_ENABLED ?? 'false';
process.env.OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? 'sistema-licencas-v2-test';
process.env.METRICS_ENABLED = process.env.METRICS_ENABLED ?? 'false';
process.env.METRICS_PATH = process.env.METRICS_PATH ?? '/metrics';


