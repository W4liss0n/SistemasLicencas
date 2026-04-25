import { ApiError } from './api-error';
import { mapProblemDetails, mapUnknownError } from './problem-mapper';

const DEFAULT_TIMEOUT_MS = 8_000;

type RequestOptions = RequestInit & {
  timeoutMs?: number;
};

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function createRequestAbortContext(
  upstreamSignal: AbortSignal | null | undefined,
  timeoutMs: number
): { signal: AbortSignal; didTimeout: () => boolean; cleanup: () => void } {
  const controller = new AbortController();
  let timeoutTriggered = false;
  const timeout = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, timeoutMs);
  const abortFromUpstream = () => controller.abort();

  if (upstreamSignal?.aborted) {
    controller.abort();
  } else {
    upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
  }

  return {
    signal: controller.signal,
    didTimeout: () => timeoutTriggered,
    cleanup: () => {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }
  };
}

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

export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...rest } = options;
  const abortContext = createRequestAbortContext(rest.signal, timeoutMs);

  try {
    const response = await fetch(url, {
      ...rest,
      signal: abortContext.signal,
      headers: {
        Accept: 'application/json, application/problem+json',
        ...(headers || {})
      }
    });

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

    if (abortContext.didTimeout() && isAbortError(error)) {
      throw new ApiError(mapUnknownError('Request timeout'));
    }

    if (isAbortError(error)) {
      throw error;
    }

    throw new ApiError(mapUnknownError(error instanceof Error ? error.message : 'Unknown network error'));
  } finally {
    abortContext.cleanup();
  }
}
