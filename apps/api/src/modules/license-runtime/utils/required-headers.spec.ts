import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { requireIdempotencyKey, requireProgramId } from './required-headers';

describe('required headers helpers', () => {
  it('requireProgramId returns trimmed value', () => {
    expect(requireProgramId(' demo-program ')).toBe('demo-program');
  });

  it('requireProgramId throws unauthorized_program when missing', () => {
    expect(() => requireProgramId('')).toThrow(DomainHttpError);

    try {
      requireProgramId('');
    } catch (error) {
      const httpError = error as DomainHttpError;
      expect(httpError.getStatus()).toBe(401);
      expect((httpError.getResponse() as { code: string }).code).toBe('unauthorized_program');
    }
  });

  it('requireIdempotencyKey returns trimmed value', () => {
    expect(requireIdempotencyKey(' abc-123 ')).toBe('abc-123');
  });

  it('requireIdempotencyKey throws invalid_request when missing', () => {
    expect(() => requireIdempotencyKey(undefined)).toThrow(DomainHttpError);

    try {
      requireIdempotencyKey(undefined);
    } catch (error) {
      const httpError = error as DomainHttpError;
      expect(httpError.getStatus()).toBe(400);
      expect((httpError.getResponse() as { code: string }).code).toBe('invalid_request');
    }
  });
});
