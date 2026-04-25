import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_PACKAGE_NAME = 'sistema-licencas-workspace';
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

type PackageJson = {
  name?: string;
  version?: string;
};

type WorkspacePaths = {
  root: string;
  api: string;
  adminWeb: string;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function normalizeStartDir(startPath: string): string {
  if (startPath.startsWith('file://')) {
    return path.dirname(fileURLToPath(startPath));
  }

  return path.resolve(startPath);
}

export function resolveWorkspacePaths(startPath: string): WorkspacePaths {
  let currentDir = normalizeStartDir(startPath);

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = readJson<PackageJson>(packageJsonPath);
      if (packageJson.name === WORKSPACE_PACKAGE_NAME) {
        return {
          root: currentDir,
          api: path.join(currentDir, 'apps', 'api'),
          adminWeb: path.join(currentDir, 'apps', 'admin-web')
        };
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error('Unable to locate workspace root package.json');
    }

    currentDir = parentDir;
  }
}

export function readPublicVersion(startPath: string): string {
  const { root } = resolveWorkspacePaths(startPath);
  const packageJson = readJson<PackageJson>(path.join(root, 'package.json'));
  const version = packageJson.version?.trim();

  if (!version) {
    throw new Error('Workspace root package.json is missing the public version');
  }

  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`Workspace public version "${version}" is not valid SemVer`);
  }

  return version;
}

export function assertMirroredPackageVersions(startPath: string): string {
  const publicVersion = readPublicVersion(startPath);
  const { api, adminWeb } = resolveWorkspacePaths(startPath);

  const mirroredPackages = [path.join(api, 'package.json'), path.join(adminWeb, 'package.json')];

  for (const manifestPath of mirroredPackages) {
    const packageJson = readJson<PackageJson>(manifestPath);
    if (packageJson.version !== publicVersion) {
      throw new Error(
        `Package manifest ${manifestPath} must mirror the workspace public version ${publicVersion}`
      );
    }
  }

  return publicVersion;
}
