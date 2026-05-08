type AdminWebRuntimeConfig = {
  adminWebEnableMutations?: boolean | string;
  adminAuthEnabled?: boolean | string;
  adminAuthIssuerUrl?: string;
  adminAuthClientId?: string;
  adminAuthAudience?: string;
  adminAuthScopes?: string;
};

export type AdminAuthRuntimeConfig = {
  enabled: boolean;
  issuerUrl: string;
  clientId: string;
  audience: string;
  scopes: string;
};

function readWindowRuntimeConfig(): AdminWebRuntimeConfig | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.__ADMIN_WEB_CONFIG__ ?? null;
}

export function isMutationsEnabled(): boolean {
  const runtime = readWindowRuntimeConfig();
  const runtimeValue = runtime?.adminWebEnableMutations;

  if (typeof runtimeValue === 'boolean') {
    return runtimeValue;
  }

  if (typeof runtimeValue === 'string') {
    return runtimeValue.toLowerCase() === 'true';
  }

  return import.meta.env.VITE_ADMIN_WEB_ENABLE_MUTATIONS === 'true';
}

function readBoolean(
  runtimeValue: boolean | string | undefined,
  envValue: string | undefined,
  defaultValue: boolean
): boolean {
  if (typeof runtimeValue === 'boolean') {
    return runtimeValue;
  }

  if (typeof runtimeValue === 'string') {
    return runtimeValue.toLowerCase() === 'true';
  }

  if (typeof envValue === 'string') {
    return envValue.toLowerCase() === 'true';
  }

  return defaultValue;
}

function readString(runtimeValue: string | undefined, envValue: string | undefined): string {
  return runtimeValue?.trim() || envValue?.trim() || '';
}

export function getAdminAuthConfig(): AdminAuthRuntimeConfig {
  const runtime = readWindowRuntimeConfig();

  return {
    enabled: readBoolean(runtime?.adminAuthEnabled, import.meta.env.VITE_ADMIN_AUTH_ENABLED, false),
    issuerUrl: readString(runtime?.adminAuthIssuerUrl, import.meta.env.VITE_ADMIN_AUTH_ISSUER_URL),
    clientId: readString(runtime?.adminAuthClientId, import.meta.env.VITE_ADMIN_AUTH_CLIENT_ID),
    audience: readString(runtime?.adminAuthAudience, import.meta.env.VITE_ADMIN_AUTH_AUDIENCE),
    scopes:
      readString(runtime?.adminAuthScopes, import.meta.env.VITE_ADMIN_AUTH_SCOPES) ||
      'openid profile email admin:access'
  };
}

export function getPublicVersion(): string {
  return __SYSTEM_PUBLIC_VERSION__;
}
