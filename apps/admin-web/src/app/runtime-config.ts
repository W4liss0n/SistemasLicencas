type AdminWebRuntimeConfig = {
  adminWebEnableMutations?: boolean | string;
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
