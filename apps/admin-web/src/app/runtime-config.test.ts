import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicVersion, isMutationsEnabled } from './runtime-config';

function readWorkspacePublicVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(path.resolve(process.cwd(), '..', '..', 'package.json'), 'utf8')
  ) as { version?: string };

  if (!packageJson.version) {
    throw new Error('Workspace root package.json is missing version');
  }

  return packageJson.version;
}

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

  it('returns the build-time public version', () => {
    expect(getPublicVersion()).toBe(readWorkspacePublicVersion());
  });
});
