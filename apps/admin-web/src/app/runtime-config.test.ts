import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMutationsEnabled } from './runtime-config';

describe('runtime-config', () => {
  afterEach(() => {
    delete window.__ADMIN_WEB_CONFIG__;
    vi.unstubAllEnvs();
  });

  it('prefers runtime config over VITE env flag', () => {
    vi.stubEnv('VITE_ADMIN_WEB_ENABLE_MUTATIONS', 'false');
    window.__ADMIN_WEB_CONFIG__ = { adminWebEnableMutations: true };

    expect(isMutationsEnabled()).toBe(true);
  });

  it('falls back to VITE env when runtime config is absent', () => {
    vi.stubEnv('VITE_ADMIN_WEB_ENABLE_MUTATIONS', 'true');

    expect(isMutationsEnabled()).toBe(true);
  });
});
