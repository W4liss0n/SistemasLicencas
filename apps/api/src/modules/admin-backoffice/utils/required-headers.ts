import { HttpStatus } from '@nestjs/common';
import { DomainHttpError } from '../../../common/errors/domain-http-error';

export function requireInternalIdempotencyKey(idempotencyKey: string | undefined): string {
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    throw new DomainHttpError({
      code: 'invalid_request',
      detail: 'Header Idempotency-Key is required',
      status: HttpStatus.BAD_REQUEST,
      title: 'Invalid request'
    });
  }

  return idempotencyKey.trim();
}
