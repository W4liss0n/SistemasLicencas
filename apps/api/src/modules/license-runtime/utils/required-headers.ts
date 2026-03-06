import { HttpStatus } from '@nestjs/common';
import { DomainHttpError } from '../../../common/errors/domain-http-error';

export function requireProgramId(programId: string | undefined): string {
  if (!programId || programId.trim().length === 0) {
    throw new DomainHttpError({
      code: 'unauthorized_program',
      detail: 'Header X-Program-Id is required',
      status: HttpStatus.UNAUTHORIZED,
      title: 'Unauthorized program'
    });
  }

  return programId.trim();
}

export function requireIdempotencyKey(idempotencyKey: string | undefined): string {
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
