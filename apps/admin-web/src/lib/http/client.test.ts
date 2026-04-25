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

describe('requestJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
