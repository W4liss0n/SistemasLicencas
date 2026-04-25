import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import {
  assertMirroredPackageVersions,
  readPublicVersion
} from '../../src/common/version/public-version';

type PackageManifest = {
  name: string;
  version?: string;
  private?: boolean;
};

function createWorkspace(manifests: {
  root: PackageManifest;
  apiVersion?: string;
  adminWebVersion?: string;
}): string {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'sistema-licencas-version-'));
  const apiDir = path.join(workspaceRoot, 'apps', 'api');
  const adminWebDir = path.join(workspaceRoot, 'apps', 'admin-web');

  mkdirSync(apiDir, { recursive: true });
  mkdirSync(adminWebDir, { recursive: true });

  writeFileSync(path.join(workspaceRoot, 'package.json'), JSON.stringify(manifests.root, null, 2));
  writeFileSync(
    path.join(apiDir, 'package.json'),
    JSON.stringify(
      {
        name: 'sistema-licencas-v2',
        version: manifests.apiVersion ?? manifests.root.version,
        private: true
      },
      null,
      2
    )
  );
  writeFileSync(
    path.join(adminWebDir, 'package.json'),
    JSON.stringify(
      {
        name: 'admin-web',
        version: manifests.adminWebVersion ?? manifests.root.version,
        private: true
      },
      null,
      2
    )
  );

  return workspaceRoot;
}

describe('public-version helper', () => {
  it('reads a valid SemVer public version and validates mirrored manifests', () => {
    const workspaceRoot = createWorkspace({
      root: {
        name: 'sistema-licencas-workspace',
        version: '2.0.0',
        private: true
      }
    });

    try {
      const startDir = path.join(workspaceRoot, 'apps', 'api', 'scripts');
      expect(readPublicVersion(startDir)).toBe('2.0.0');
      expect(assertMirroredPackageVersions(startDir)).toBe('2.0.0');
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('fails when the workspace public version is missing', () => {
    const workspaceRoot = createWorkspace({
      root: {
        name: 'sistema-licencas-workspace',
        private: true
      }
    });

    try {
      expect(() => readPublicVersion(workspaceRoot)).toThrow(
        'Workspace root package.json is missing the public version'
      );
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('fails when the workspace public version is not valid SemVer', () => {
    const workspaceRoot = createWorkspace({
      root: {
        name: 'sistema-licencas-workspace',
        version: '2',
        private: true
      }
    });

    try {
      expect(() => readPublicVersion(workspaceRoot)).toThrow(
        'Workspace public version "2" is not valid SemVer'
      );
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
