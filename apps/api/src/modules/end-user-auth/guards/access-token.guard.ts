import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { EndUserAuthService, type AccessTokenClaims } from '../services/end-user-auth.service';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  auth?: AccessTokenClaims;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authService: EndUserAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = this.normalize(request.headers.authorization);

    if (!authorization?.startsWith('Bearer ')) {
      throw new DomainHttpError({
        status: 401,
        code: 'invalid_credentials',
        detail: 'Bearer token is required',
        title: 'Invalid credentials'
      });
    }

    const accessToken = authorization.slice('Bearer '.length).trim();
    request.auth = await this.authService.verifyAccessToken(accessToken);
    return true;
  }

  private normalize(value: string | string[] | undefined): string {
    if (!value) {
      return '';
    }

    if (Array.isArray(value)) {
      return String(value[0] ?? '').trim();
    }

    return String(value).trim();
  }
}
