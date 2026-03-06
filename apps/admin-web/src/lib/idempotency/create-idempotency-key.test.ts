import { describe, expect, it } from 'vitest';
import { createIdempotencyKey } from './create-idempotency-key';

describe('createIdempotencyKey', () => {
  it('returns key with adm- prefix', () => {
    const key = createIdempotencyKey();
    expect(key.startsWith('adm-')).toBe(true);
  });

  it('returns unique keys across calls', () => {
    const a = createIdempotencyKey();
    const b = createIdempotencyKey();
    expect(a).not.toBe(b);
  });
});
