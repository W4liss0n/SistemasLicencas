const baseUrl = process.env.GATEWAY_BASE_URL || 'https://localhost';
const username = process.env.GATEWAY_BASIC_AUTH_USER || '';
const password = process.env.GATEWAY_BASIC_AUTH_PASSWORD || '';
const insecureTls = (process.env.GATEWAY_INSECURE_TLS || 'true').toLowerCase() === 'true';

if (insecureTls) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

function assertStatus(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${name}: expected ${expected}, received ${actual}`);
  }
}

function basicAuthHeader() {
  if (!username || !password) {
    return null;
  }

  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

async function run() {
  const unauthAdmin = await fetch(`${baseUrl}/`, { redirect: 'manual' });
  assertStatus('admin-ui-without-basic-auth', unauthAdmin.status, 401);

  const health = await fetch(`${baseUrl}/api/v2/health`, { redirect: 'manual' });
  assertStatus('public-health', health.status, 200);

  const internalDirect = await fetch(`${baseUrl}/api/v2/internal/admin/operational-summary`, { redirect: 'manual' });
  assertStatus('internal-admin-direct', internalDirect.status, 403);

  const authHeader = basicAuthHeader();
  if (!authHeader) {
    throw new Error('GATEWAY_BASIC_AUTH_USER and GATEWAY_BASIC_AUTH_PASSWORD are required');
  }

  const proxiedInternal = await fetch(`${baseUrl}/admin-api/operational-summary?window_days=7`, {
    headers: {
      Authorization: authHeader
    },
    redirect: 'manual'
  });
  assertStatus('admin-proxy-with-basic-auth', proxiedInternal.status, 200);

  console.log('gateway smoke test: OK');
}

run().catch((error) => {
  console.error('gateway smoke test: FAILED');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
