import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import {
  LoginRequestDto,
  LoginResponseDto,
  OidcConfigResponseDto,
  LogoutRequestDto,
  LogoutResponseDto,
  MeResponseDto,
  RefreshRequestDto,
  RefreshResponseDto
} from '../dto/auth.dto';
import { requireProgramId } from '../../license-runtime/utils/required-headers';
import { EndUserAuthService } from '../services/end-user-auth.service';
import { AccessTokenGuard, type AuthenticatedRequest } from '../guards/access-token.guard';

@ApiTags('end-user-auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(EndUserAuthService) private readonly endUserAuthService: EndUserAuthService) {}

  @Get('oidc/config')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get OIDC public configuration for browser login flow' })
  @ApiResponse({ status: 200, type: OidcConfigResponseDto })
  async oidcConfig(): Promise<OidcConfigResponseDto> {
    return this.endUserAuthService.getOidcConfig();
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate end user and issue online/offline tokens' })
  @ApiHeader({ name: 'X-Program-Id', required: true })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials or unauthorized program' })
  @ApiResponse({ status: 403, description: 'Access pending, user blocked, or entitlement denied' })
  async login(
    @Headers('x-program-id') programIdHeader: string | undefined,
    @Body() payload: LoginRequestDto,
    @Req() request: FastifyRequest
  ): Promise<LoginResponseDto> {
    const programId = requireProgramId(programIdHeader);
    return this.endUserAuthService.login(programId, payload, request.ip);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate session tokens using refresh token' })
  @ApiHeader({ name: 'X-Program-Id', required: true })
  @ApiResponse({ status: 200, type: RefreshResponseDto })
  async refresh(
    @Headers('x-program-id') programIdHeader: string | undefined,
    @Body() payload: RefreshRequestDto,
    @Req() request: FastifyRequest
  ): Promise<RefreshResponseDto> {
    const programId = requireProgramId(programIdHeader);
    return this.endUserAuthService.refresh(programId, payload, request.ip);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout and revoke active refresh session' })
  @ApiHeader({ name: 'X-Program-Id', required: true })
  @ApiResponse({ status: 200, type: LogoutResponseDto })
  async logout(
    @Headers('x-program-id') programIdHeader: string | undefined,
    @Body() payload: LogoutRequestDto,
    @Req() request: FastifyRequest
  ): Promise<LogoutResponseDto> {
    const programId = requireProgramId(programIdHeader);
    return this.endUserAuthService.logout(programId, payload.refresh_token, request.ip);
  }

  @Get('me')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Get authenticated end user profile and entitlement' })
  @ApiHeader({ name: 'X-Program-Id', required: true })
  @ApiHeader({ name: 'Authorization', required: true })
  @ApiResponse({ status: 200, type: MeResponseDto })
  async me(
    @Headers('x-program-id') programIdHeader: string | undefined,
    @Req() request: AuthenticatedRequest
  ): Promise<MeResponseDto> {
    const programId = requireProgramId(programIdHeader);
    return this.endUserAuthService.me(programId, request.auth!);
  }
}
