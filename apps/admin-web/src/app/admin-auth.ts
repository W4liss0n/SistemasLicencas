import {
  readSessionStorage,
  removeSessionStorage,
  writeSessionStorage
} from './browser-storage';
import { getAdminAuthConfig } from './runtime-config';

const AUTH_SESSION_KEY = 'admin-web-auth-session';
const AUTH_TRANSACTION_KEY = 'admin-web-auth-transaction';
const AUTH_EXPIRY_SKEW_MS = 30_000;

type AdminAuthSession = {
  accessToken: string;
  expiresAtMs: number;
  idToken?: string;
  operatorName?: string;
  subject?: string;
};

type AdminAuthTransaction = {
  codeVerifier: string;
  state: string;
  returnTo: string;
  redirectUri: string;
};

type Auth0TokenResponse = {
  access_token?: unknown;
  id_token?: unknown;
  expires_in?: unknown;
};

type TokenClaims = {
  sub?: unknown;
  name?: unknown;
  email?: unknown;
  nickname?: unknown;
};

export function isAdminAuthEnabled(): boolean {
  return getAdminAuthConfig().enabled;
}

export function getAdminAuthAccessToken(): string | null {
  return readValidSession()?.accessToken ?? null;
}

export function getAdminAuthOperatorName(): string | null {
  const session = readValidSession();
  return session?.operatorName ?? session?.subject ?? null;
}

export function hasAdminAuthSession(): boolean {
  return readValidSession() !== null;
}

export function clearAdminAuthSession(): void {
  removeSessionStorage(AUTH_SESSION_KEY);
  removeSessionStorage(AUTH_TRANSACTION_KEY);
}

export async function startAdminAuthLogin(returnTo = '/dashboard'): Promise<void> {
  const config = getAdminAuthConfig();
  assertAuthConfig(config);

  const codeVerifier = randomBase64Url(64);
  const state = randomBase64Url(32);
  const redirectUri = `${window.location.origin}/login`;
  const transaction: AdminAuthTransaction = {
    codeVerifier,
    state,
    returnTo: normalizeReturnTo(returnTo),
    redirectUri
  };

  writeSessionStorage(AUTH_TRANSACTION_KEY, JSON.stringify(transaction));

  const authorizeUrl = new URL('authorize', normalizeIssuerUrl(config.issuerUrl));
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('audience', config.audience);
  authorizeUrl.searchParams.set('scope', config.scopes);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', await createCodeChallenge(codeVerifier));
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  window.location.assign(authorizeUrl.toString());
}

export async function completeAdminAuthCallback(currentUrl = window.location.href): Promise<string> {
  const config = getAdminAuthConfig();
  assertAuthConfig(config);

  const url = new URL(currentUrl);
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  if (error) {
    throw new Error(errorDescription || error);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    throw new Error('Auth0 callback is missing code or state');
  }

  const transaction = readTransaction();
  if (!transaction || transaction.state !== state) {
    throw new Error('Auth0 callback state does not match the pending login');
  }

  const tokenResponse = await requestTokens(config.issuerUrl, {
    clientId: config.clientId,
    code,
    codeVerifier: transaction.codeVerifier,
    redirectUri: transaction.redirectUri
  });

  const session = buildSession(tokenResponse);
  writeSessionStorage(AUTH_SESSION_KEY, JSON.stringify(session));
  removeSessionStorage(AUTH_TRANSACTION_KEY);

  return transaction.returnTo;
}

export function hasAdminAuthCallbackParams(currentUrl = window.location.href): boolean {
  if (!isAdminAuthEnabled()) {
    return false;
  }

  const url = new URL(currentUrl);
  return url.searchParams.has('code') || url.searchParams.has('error');
}

function readValidSession(): AdminAuthSession | null {
  const raw = readSessionStorage(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as Partial<AdminAuthSession>;
    if (
      typeof session.accessToken !== 'string' ||
      typeof session.expiresAtMs !== 'number' ||
      session.expiresAtMs <= Date.now()
    ) {
      clearAdminAuthSession();
      return null;
    }

    return session as AdminAuthSession;
  } catch {
    clearAdminAuthSession();
    return null;
  }
}

function readTransaction(): AdminAuthTransaction | null {
  const raw = readSessionStorage(AUTH_TRANSACTION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const transaction = JSON.parse(raw) as Partial<AdminAuthTransaction>;
    if (
      typeof transaction.codeVerifier !== 'string' ||
      typeof transaction.state !== 'string' ||
      typeof transaction.returnTo !== 'string' ||
      typeof transaction.redirectUri !== 'string'
    ) {
      return null;
    }

    return transaction as AdminAuthTransaction;
  } catch {
    return null;
  }
}

function buildSession(tokenResponse: Auth0TokenResponse): AdminAuthSession {
  if (typeof tokenResponse.access_token !== 'string') {
    throw new Error('Auth0 token response did not include an access token');
  }

  const expiresInSeconds =
    typeof tokenResponse.expires_in === 'number' && tokenResponse.expires_in > 0
      ? tokenResponse.expires_in
      : 300;
  const idToken = typeof tokenResponse.id_token === 'string' ? tokenResponse.id_token : undefined;
  const claims = idToken ? decodeJwtClaims(idToken) : null;

  return {
    accessToken: tokenResponse.access_token,
    expiresAtMs: Date.now() + expiresInSeconds * 1000 - AUTH_EXPIRY_SKEW_MS,
    idToken,
    operatorName: readOperatorName(claims),
    subject: typeof claims?.sub === 'string' ? claims.sub : undefined
  };
}

async function requestTokens(
  issuerUrl: string,
  input: {
    clientId: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }
): Promise<Auth0TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: input.clientId,
    code: input.code,
    code_verifier: input.codeVerifier,
    redirect_uri: input.redirectUri
  });

  const response = await fetch(new URL('oauth/token', normalizeIssuerUrl(issuerUrl)), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const payload = (await response.json().catch(() => ({}))) as Auth0TokenResponse & {
    error?: unknown;
    error_description?: unknown;
  };

  if (!response.ok) {
    throw new Error(
      typeof payload.error_description === 'string'
        ? payload.error_description
        : 'Auth0 token exchange failed'
    );
  }

  return payload;
}

function assertAuthConfig(config: ReturnType<typeof getAdminAuthConfig>): void {
  if (!config.enabled) {
    throw new Error('Admin Auth0 is disabled');
  }

  if (!config.issuerUrl || !config.clientId || !config.audience) {
    throw new Error('Admin Auth0 config is incomplete');
  }
}

function normalizeIssuerUrl(value: string): string {
  const url = new URL(value);
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  return url.toString();
}

function normalizeReturnTo(returnTo: string): string {
  return returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard';
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeJwtClaims(token: string): TokenClaims | null {
  const [, payload] = token.split('.');
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as TokenClaims;
  } catch {
    return null;
  }
}

function readOperatorName(claims: TokenClaims | null): string | undefined {
  for (const key of ['name', 'email', 'nickname', 'sub'] as const) {
    const value = claims?.[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}
