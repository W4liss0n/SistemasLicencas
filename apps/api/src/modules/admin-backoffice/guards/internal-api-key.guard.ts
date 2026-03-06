import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { AppConfigService } from '../../../config/app-config.service';
import { DomainHttpError } from '../../../common/errors/domain-http-error';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly configService: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const header = request.headers['x-internal-api-key'];
    const provided = this.normalizeHeaderValue(header);

    if (!provided) {
      this.throwUnauthorized('Header X-Internal-Api-Key is required');
    }

    const allowed = this.configService.internalAdminApiKeys;
    let matched = false;
    for (const expected of allowed) {
      matched = this.timingSafeMatch(provided, expected) || matched;
    }

    if (!matched) {
      this.throwUnauthorized('Invalid internal admin key');
    }

    return true;
  }

  private normalizeHeaderValue(value: string | string[] | undefined): string {
    if (!value) {
      return '';
    }

    if (Array.isArray(value)) {
      return (value[0] ?? '').trim();
    }

    return value.trim();
  }

  private timingSafeMatch(provided: string, expected: string): boolean {
    const providedBuffer = Buffer.from(provided, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
  }

  private throwUnauthorized(detail: string): never {
    throw new DomainHttpError({
      code: 'unauthorized_internal',
      detail,
      status: HttpStatus.UNAUTHORIZED,
      title: 'Unauthorized internal request'
    });
  }
}
