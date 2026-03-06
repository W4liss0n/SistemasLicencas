import { createServer } from 'node:http';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { URL, URLSearchParams } from 'node:url';
import { SignJWT, exportJWK } from 'jose';

const port = Number.parseInt(process.env.MOCK_OIDC_PORT ?? '4010', 10);
const issuer = process.env.MOCK_OIDC_ISSUER ?? `http://127.0.0.1:${port}`;
const clientId = process.env.MOCK_OIDC_CLIENT_ID ?? 'launcher-client';
const defaultEmail = process.env.MOCK_OIDC_EMAIL ?? 'user.demo@example.com';
const defaultSubject = process.env.MOCK_OIDC_SUBJECT ?? 'mock-user-1';
const keyId = process.env.MOCK_OIDC_KID ?? 'mock-oidc-key-v1';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048
});

const publicJwk = await exportJWK(publicKey);
publicJwk.alg = 'RS256';
publicJwk.use = 'sig';
publicJwk.kid = keyId;

const codeStore = new Map();

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  try {
    const baseUrl = `${issuer}`;
    const requestUrl = new URL(req.url ?? '/', baseUrl);
    const pathname = requestUrl.pathname;

    if (req.method === 'GET' && pathname === '/') {
      return json(res, 200, {
        message: 'Mock OIDC provider is running',
        issuer,
        client_id: clientId,
        authorize: `${issuer}/authorize`,
        token: `${issuer}/oauth/token`,
        jwks: `${issuer}/jwks`
      });
    }

    if (req.method === 'GET' && pathname === '/.well-known/openid-configuration') {
      return json(res, 200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/oauth/token`,
        jwks_uri: `${issuer}/jwks`,
        id_token_signing_alg_values_supported: ['RS256']
      });
    }

    if (req.method === 'GET' && pathname === '/jwks') {
      return json(res, 200, {
        keys: [publicJwk]
      });
    }

    if (req.method === 'GET' && pathname === '/authorize') {
      const redirectUri = requestUrl.searchParams.get('redirect_uri');
      const state = requestUrl.searchParams.get('state');
      const nonce = requestUrl.searchParams.get('nonce');
      const requestClientId = requestUrl.searchParams.get('client_id');
      const responseType = requestUrl.searchParams.get('response_type');

      if (!redirectUri || !state || !nonce || !requestClientId || responseType !== 'code') {
        return json(res, 400, {
          error: 'invalid_request',
          detail: 'Missing required authorize parameters'
        });
      }

      if (requestClientId !== clientId) {
        return json(res, 400, {
          error: 'invalid_client',
          detail: 'client_id mismatch'
        });
      }

      const code = randomBytes(24).toString('hex');
      codeStore.set(code, {
        nonce,
        clientId: requestClientId,
        redirectUri,
        email: defaultEmail,
        subject: defaultSubject
      });

      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set('code', code);
      callbackUrl.searchParams.set('state', state);

      return redirect(res, callbackUrl.toString());
    }

    if (req.method === 'POST' && pathname === '/oauth/token') {
      const rawBody = await readBody(req);
      const params = new URLSearchParams(rawBody);

      const grantType = params.get('grant_type');
      const code = params.get('code');
      const requestClientId = params.get('client_id');
      const redirectUri = params.get('redirect_uri');
      const codeVerifier = params.get('code_verifier');

      if (
        grantType !== 'authorization_code' ||
        !code ||
        !requestClientId ||
        !redirectUri ||
        !codeVerifier
      ) {
        return json(res, 400, {
          error: 'invalid_request',
          detail: 'Missing required token parameters'
        });
      }

      const authCode = codeStore.get(code);
      if (!authCode) {
        return json(res, 400, {
          error: 'invalid_grant',
          detail: 'Unknown authorization code'
        });
      }

      if (authCode.clientId !== requestClientId || authCode.redirectUri !== redirectUri) {
        return json(res, 400, {
          error: 'invalid_grant',
          detail: 'Authorization code mismatch'
        });
      }

      codeStore.delete(code);

      const idToken = await new SignJWT({
        sub: authCode.subject,
        email: authCode.email,
        email_verified: true,
        nonce: authCode.nonce
      })
        .setProtectedHeader({ alg: 'RS256', kid: keyId })
        .setIssuer(issuer)
        .setAudience(requestClientId)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);

      return json(res, 200, {
        token_type: 'Bearer',
        access_token: `mock-access-${randomBytes(8).toString('hex')}`,
        expires_in: 300,
        id_token: idToken
      });
    }

    json(res, 404, { error: 'not_found' });
  } catch (error) {
    json(res, 500, {
      error: 'server_error',
      detail: error instanceof Error ? error.message : 'unexpected error'
    });
  }
});

server.listen(port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-oidc] running at ${issuer}`);
  // eslint-disable-next-line no-console
  console.log(`[mock-oidc] default identity email=${defaultEmail} sub=${defaultSubject}`);
});

