import { ApiError } from './api-error';
import { mapProblemDetails, mapUnknownError } from './problem-mapper';

const DEFAULT_TIMEOUT_MS = 8_000;

type RequestOptions = RequestInit & {
  timeoutMs?: number;
};

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { title: response.statusText || 'Invalid JSON', detail: text };
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const upstreamSignal = options.signal;
  const abortFromUpstream = () => controller.abort();

  if (upstreamSignal?.aborted) {
    controller.abort();
  } else {
    upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
  }

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener('abort', abortFromUpstream);
  }
}

export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...rest } = options;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        ...rest,
        headers: {
          Accept: 'application/json, application/problem+json',
          ...(headers || {})
        }
      },
      timeoutMs
    );

    const payload = await parseJsonSafe(response);

    if (!response.ok) {
      const mapped = mapProblemDetails(payload, response.status);
      if (typeof window !== 'undefined' && (response.status === 401 || response.status === 403)) {
        window.location.assign('/access-denied');
      }
      throw new ApiError(mapped);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(mapUnknownError('Request timeout'));
    }

    throw new ApiError(mapUnknownError(error instanceof Error ? error.message : 'Unknown network error'));
  }
}
