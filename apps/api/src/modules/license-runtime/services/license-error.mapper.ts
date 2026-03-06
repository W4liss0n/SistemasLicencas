import { HttpStatus } from '@nestjs/common';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import type { LicenseEngineFailure } from '../ports/license-engine.port';

const statusMap: Record<LicenseEngineFailure['code'], HttpStatus> = {
  invalid_request: HttpStatus.BAD_REQUEST,
  unauthorized_program: HttpStatus.UNAUTHORIZED,
  license_not_found: HttpStatus.NOT_FOUND,
  license_blocked: HttpStatus.FORBIDDEN,
  subscription_expired: HttpStatus.FORBIDDEN,
  program_not_included: HttpStatus.FORBIDDEN,
  fingerprint_mismatch: HttpStatus.FORBIDDEN,
  max_devices_reached: HttpStatus.CONFLICT,
  transfer_limit_exceeded: HttpStatus.TOO_MANY_REQUESTS
};

export function throwFromLicenseEngineFailure(failure: LicenseEngineFailure): never {
  throw new DomainHttpError({
    code: failure.code,
    detail: failure.detail,
    status: statusMap[failure.code] ?? HttpStatus.BAD_REQUEST,
    title: failure.code.replace(/_/g, ' ')
  });
}
