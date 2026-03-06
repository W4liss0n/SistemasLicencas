import { Body, Controller, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatePublicResponseDto,
  AuthenticateRequestDto
} from '../dto/license.dto';
import { AuthenticationService } from '../services/authentication.service';
import { requireProgramId } from '../utils/required-headers';

@ApiTags('license-auth')
@Controller('license')
export class LicenseAuthController {
  constructor(
    @Inject(AuthenticationService)
    private readonly authenticationService: AuthenticationService
  ) {}

  @Post('authenticate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate license client credentials' })
  @ApiHeader({ name: 'X-Program-Id', required: true })
  @ApiHeader({ name: 'X-Request-Id', required: false })
  @ApiResponse({ status: 200, type: AuthenticatePublicResponseDto })
  async authenticate(
    @Headers('x-program-id') programIdHeader: string | undefined,
    @Body() body: AuthenticateRequestDto
  ): Promise<AuthenticatePublicResponseDto> {
    const programId = requireProgramId(programIdHeader);
    return this.authenticationService.authenticateWithProgram(programId, body);
  }
}
