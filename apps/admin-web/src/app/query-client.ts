import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/http/api-error';

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) {
    return false;
  }

  if (error instanceof ApiError) {
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
  }

  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 20_000,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: false
    }
  }
});
