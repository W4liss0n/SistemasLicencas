/// <reference types="vite/client" />

declare const __SYSTEM_PUBLIC_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_ADMIN_WEB_ENABLE_MUTATIONS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __ADMIN_WEB_CONFIG__?: {
    adminWebEnableMutations?: boolean | string;
  };
}
