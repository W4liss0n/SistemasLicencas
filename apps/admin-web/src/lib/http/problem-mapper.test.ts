import { describe, expect, it } from 'vitest';
import { mapProblemDetails, mapUnknownError } from './problem-mapper';

describe('problem mapper', () => {
  it('maps explicit problem details payload', () => {
    const mapped = mapProblemDetails(
      {
        title: 'Invalid request',
        status: 400,
        detail: 'Field program_code is required',
        trace_id: 'trace-123'
      },
      400
    );

    expect(mapped.title).toBe('Invalid request');
    expect(mapped.detail).toContain('program_code');
    expect(mapped.trace_id).toBe('trace-123');
  });

  it('falls back for unknown payload', () => {
    const mapped = mapProblemDetails('oops', 500);
    expect(mapped.title).toBe('Internal error');
    expect(mapped.status).toBe(500);
  });

  it('maps unknown network error', () => {
    const mapped = mapUnknownError('connection reset');
    expect(mapped.status).toBe(0);
    expect(mapped.title).toBe('Network error');
  });
});
