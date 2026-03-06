import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { AuthenticateRequestDto } from '../dto/license.dto';
import {
  IDENTITY_ACCESS_PORT,
  IdentityAccessPort
} from '../../identity-access/ports/identity-access.port';

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(
    @Inject(IDENTITY_ACCESS_PORT)
    private readonly identityAccessPort: IdentityAccessPort
  ) {}

  async authenticateWithProgram(
    programId: string,
    payload: AuthenticateRequestDto
  ): Promise<{
    success: boolean;
    access_token: string;
    issued_at: string;
    expires_at: string;
  }> {
    const result = await this.identityAccessPort.authenticateProgramClient({
      programId,
      identifier: payload.identifier,
      password: payload.password
    });

    if (!result.ok) {
      if (result.code === 'unauthorized_program') {
        throw new DomainHttpError({
          code: result.code,
          detail: result.detail,
          status: HttpStatus.UNAUTHORIZED,
          title: 'Unauthorized program'
        });
      }

      throw new DomainHttpError({
        code: result.code,
        detail: result.detail,
        status: HttpStatus.UNAUTHORIZED,
        title: 'Invalid credentials'
      });
    }

    this.logger.log(`Authentication success for ${payload.identifier.trim().toLowerCase()}`);

    return {
      success: true,
      access_token: result.accessToken,
      issued_at: result.issuedAt,
      expires_at: result.expiresAt
    };
  }
}
