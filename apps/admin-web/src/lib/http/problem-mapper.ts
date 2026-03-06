import type { ProblemDetails } from '../../types/api';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function mapProblemDetails(payload: unknown, status: number): ProblemDetails {
  const record = asRecord(payload);
  const title = typeof record?.title === 'string' && record.title.trim().length > 0
    ? record.title
    : status >= 500
      ? 'Internal error'
      : 'Request failed';

  return {
    title,
    status,
    type: typeof record?.type === 'string' ? record.type : undefined,
    code: typeof record?.code === 'string' ? record.code : undefined,
    detail: typeof record?.detail === 'string' ? record.detail : undefined,
    instance: typeof record?.instance === 'string' ? record.instance : undefined,
    trace_id: typeof record?.trace_id === 'string' ? record.trace_id : undefined
  };
}

export function mapUnknownError(message: string): ProblemDetails {
  return {
    title: 'Network error',
    status: 0,
    detail: message
  };
}
