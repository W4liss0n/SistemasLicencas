/// <reference types="vite/client" />

declare const __SYSTEM_PUBLIC_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_ADMIN_WEB_ENABLE_MUTATIONS?: string;
  readonly VITE_ADMIN_AUTH_ENABLED?: string;
  readonly VITE_ADMIN_AUTH_ISSUER_URL?: string;
  readonly VITE_ADMIN_AUTH_CLIENT_ID?: string;
  readonly VITE_ADMIN_AUTH_AUDIENCE?: string;
  readonly VITE_ADMIN_AUTH_SCOPES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __ADMIN_WEB_CONFIG__?: {
    adminWebEnableMutations?: boolean | string;
    adminAuthEnabled?: boolean | string;
    adminAuthIssuerUrl?: string;
    adminAuthClientId?: string;
    adminAuthAudience?: string;
    adminAuthScopes?: string;
  };
}
