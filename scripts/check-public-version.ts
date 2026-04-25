import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  assertMirroredPackageVersions,
  resolveWorkspacePaths
} from '../apps/api/src/common/version/public-version';

type OpenApiDocument = {
  info?: {
    version?: string;
  };
};

function main(): void {
  const shouldCheckOpenApi = process.argv.includes('--openapi');
  const publicVersion = assertMirroredPackageVersions(__dirname);
  const { root } = resolveWorkspacePaths(__dirname);
  const openApiPath = path.join(root, '.openapi', 'openapi.v2.json');

  if (shouldCheckOpenApi) {
    if (!existsSync(openApiPath)) {
      throw new Error(`Generated OpenAPI document is missing at ${openApiPath}`);
    }

    const openApi = JSON.parse(readFileSync(openApiPath, 'utf8')) as OpenApiDocument;
    const openApiVersion = openApi.info?.version;

    if (openApiVersion !== publicVersion) {
      throw new Error(
        `Generated OpenAPI version ${openApiVersion ?? '<missing>'} does not match public version ${publicVersion}`
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `Public version check passed (${publicVersion})${shouldCheckOpenApi ? ' with OpenAPI' : ''}`
  );
}

main();
