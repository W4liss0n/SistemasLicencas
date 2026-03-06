import path from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';

async function run() {
  const file = path.join(process.cwd(), '..', '..', '.openapi', 'openapi.v2.json');
  await SwaggerParser.validate(file);
  console.log('OpenAPI document is valid:', file);
}

run().catch((error) => {
  console.error('OpenAPI validation failed:', error.message || error);
  process.exit(1);
});