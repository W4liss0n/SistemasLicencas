import { readPublicVersion } from '../../src/common/version/public-version';
import { buildOpenApiDocumentConfig } from '../../scripts/generate-openapi';

describe('generate-openapi', () => {
  it('uses the canonical workspace public version in the OpenAPI config', () => {
    const publicVersion = readPublicVersion(__dirname);
    const config = buildOpenApiDocumentConfig();

    expect(config.info?.version).toBe(publicVersion);
  });
});
