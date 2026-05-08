import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';
import { requestJson } from './client';

function stubPendingFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('The operation was aborted.', 'AbortError')),
          { once: true }
        );
      });
    })
  );
}

function stubFetchWithStalledBody(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () =>
          new Promise<string>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('The operation was aborted.', 'AbortError')),
              { once: true }
            );
          })
      } as Response);
    })
  );
}

function stubJsonResponse(status: number, payload: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 403 ? 'Forbidden' : 'Unauthorized',
        text: () => Promise.resolve(JSON.stringify(payload))
      } as Response)
    )
  );
}

function stubAccessDeniedNavigation(): ReturnType<typeof vi.fn> {
  const assign = vi.fn();
  const windowStub = Object.create(window) as Window & typeof globalThis;
  Object.defineProperty(windowStub, 'location', {
    configurable: true,
    value: {
      ...window.location,
      assign
    }
  });
  vi.stubGlobal('window', windowStub);
  return assign;
}

describe('requestJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.__ADMIN_WEB_CONFIG__;
    window.sessionStorage.clear();
  });

  it('maps timeout-triggered aborts to ApiError', async () => {
    stubPendingFetch();

    await expect(requestJson('/admin-api/slow', { timeoutMs: 1 })).rejects.toMatchObject({
      name: 'ApiError',
      problem: {
        detail: 'Request timeout'
      }
    });
  });

  it('keeps timeout enforcement active while reading the response body', async () => {
    stubFetchWithStalledBody();

    await expect(requestJson('/admin-api/slow-body', { timeoutMs: 1 })).rejects.toMatchObject({
      name: 'ApiError',
      problem: {
        detail: 'Request timeout'
      }
    });
  });

  it('rethrows caller-triggered aborts without mapping them to timeout errors', async () => {
    stubPendingFetch();
    const controller = new AbortController();

    const request = requestJson('/admin-api/cancelled', {
      signal: controller.signal,
      timeoutMs: 1_000
    });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await request.catch((error: unknown) => {
      expect(error).not.toBeInstanceOf(ApiError);
    });
  });

  it('sends Auth0 bearer token through the admin proxy header when admin auth is enabled', async () => {
    window.__ADMIN_WEB_CONFIG__ = {
      adminAuthEnabled: true,
      adminAuthIssuerUrl: 'https://tenant.example.auth0.com/',
      adminAuthClientId: 'admin-spa',
      adminAuthAudience: 'https://api.example.com/admin',
      adminAuthScopes: 'openid profile email admin:access'
    };
    window.sessionStorage.setItem(
      'admin-web-auth-session',
      JSON.stringify({
        accessToken: 'admin-token',
        expiresAtMs: Date.now() + 60_000
      })
    );
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('{"ok":true}')
      } as Response)
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestJson('/admin-api/check')).resolves.toEqual({ ok: true });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      'X-Admin-Authorization': 'Bearer admin-token'
    });
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('keeps domain 403 errors in the calling UI instead of redirecting to access denied', async () => {
    const assign = stubAccessDeniedNavigation();
    stubJsonResponse(403, {
      title: 'Forbidden',
      status: 403,
      code: 'program_not_included',
      detail: 'Program not included in subscription plan'
    });

    await expect(requestJson('/admin-api/licenses')).rejects.toMatchObject({
      name: 'ApiError',
      problem: {
        status: 403,
        code: 'program_not_included'
      }
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it('redirects admin authentication failures to access denied', async () => {
    const assign = stubAccessDeniedNavigation();
    stubJsonResponse(403, {
      title: 'Forbidden',
      status: 403,
      code: 'admin_auth_forbidden',
      detail: 'Missing required admin scope'
    });

    await expect(requestJson('/admin-api/licenses')).rejects.toMatchObject({
      name: 'ApiError',
      problem: {
        status: 403,
        code: 'admin_auth_forbidden'
      }
    });
    expect(assign).toHaveBeenCalledWith('/access-denied');
  });
});
