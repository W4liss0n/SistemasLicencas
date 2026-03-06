import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import {
  ActivateLicenseRequestDto,
  ActivateLicenseResponseDto,
  DeactivateLicenseRequestDto,
  DeactivateLicenseResponseDto,
  HeartbeatRequestDto,
  HeartbeatResponseDto,
  TransferLicenseRequestDto,
  TransferLicenseResponseDto,
  ValidateLicenseRequestDto,
  ValidateLicenseResponseDto
} from '../dto/license.dto';
import { LicenseValidationService } from '../services/license-validation.service';
import { LicenseActivationService } from '../services/license-activation.service';
import { LicenseHeartbeatService } from '../services/license-heartbeat.service';
import { LicenseTransferService } from '../services/license-transfer.service';
import { LicenseDeactivationService } from '../services/license-deactivation.service';
import { requireIdempotencyKey, requireProgramId } from '../utils/required-headers';

@ApiTags('licenses')
@Controller('licenses')
export class LicensesController {
  constructor(
    @Inject(LicenseValidationService)
    private readonly licenseValidationService: LicenseValidationService,
    @Inject(LicenseActivationService)
    private readonly licenseActivationService: LicenseActivationService,
    @Inject(LicenseHeartbeatService)
    private readonly licenseHeartbeatService: LicenseHeartbeatService,
    @Inject(LicenseTransferService)
    private readonly licenseTransferService: LicenseTransferService,
    @Inject(LicenseDeactivationService)
    private readonly licenseDeactivationService: LicenseDeactivationService
  ) {}

  @Post('validate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Validate license' })
  @ApiHeader({ name: 'X-Program-Id', required: true })
  @ApiHeader({ name: 'X-Request-Id', required: false })
  @ApiResponse({ status: 200, type: ValidateLicenseResponseDto })
  async validate(
    @Headers('x-program-id') programIdHeader: string | undefined,
    @Body() payload: ValidateLicenseRequestDto,
    @Req() request: FastifyRequest
  ): Promise<ValidateLicenseResponseDto> {
    const programId = requireProgramId(programIdHeader);
    return this.licenseValidationService.validate(programId, payload, request.ip);
  }

  @Post('activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate license for device' })
  @ApiHeader({ name: 'X-Program-Id', required: true })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'X-Request-Id', required: false })
  @ApiResponse({ status: 200, type: ActivateLicenseResponseDto })
  async activate(
    @Headers('x-program-id') programIdHeader: string | undefined,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: ActivateLicenseRequestDto,
    @Req() request: FastifyRequest
  ): Promise<ActivateLicenseResponseDto> {
    const programId = requireProgramId(programIdHeader);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.licenseActivationService.activate(programId, payload, idempotencyKey, request.ip);
  }

  @Post('heartbeat')
  @HttpCode(200)
  @ApiOperation({ summary: 'Heartbeat validation for active license' })
  @ApiHeader({ name: 'X-Program-Id', required: true })
  @ApiHeader({ name: 'X-Request-Id', required: false })
  @ApiResponse({ status: 200, type: HeartbeatResponseDto })
  async heartbeat(
    @Headers('x-program-id') programIdHeader: string | undefined,
    @Body() payload: HeartbeatRequestDto,
    @Req() request: FastifyRequest
  ): Promise<HeartbeatResponseDto> {
    const programId = requireProgramId(programIdHeader);
    return this.licenseHeartbeatService.heartbeat(programId, payload, request.ip);
  }

  @Post('transfer')
  @HttpCode(200)
  @ApiOperation({ summary: 'Transfer license to another device' })
  @ApiHeader({ name: 'X-Program-Id', required: true })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'X-Request-Id', required: false })
  @ApiResponse({ status: 200, type: TransferLicenseResponseDto })
  async transfer(
    @Headers('x-program-id') programIdHeader: string | undefined,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: TransferLicenseRequestDto,
    @Req() request: FastifyRequest
  ): Promise<TransferLicenseResponseDto> {
    const programId = requireProgramId(programIdHeader);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.licenseTransferService.transfer(programId, payload, idempotencyKey, request.ip);
  }

  @Post('deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate current device from license' })
  @ApiHeader({ name: 'X-Program-Id', required: true })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'X-Request-Id', required: false })
  @ApiResponse({ status: 200, type: DeactivateLicenseResponseDto })
  async deactivate(
    @Headers('x-program-id') programIdHeader: string | undefined,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: DeactivateLicenseRequestDto,
    @Req() request: FastifyRequest
  ): Promise<DeactivateLicenseResponseDto> {
    const programId = requireProgramId(programIdHeader);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.licenseDeactivationService.deactivate(
      programId,
      payload,
      idempotencyKey,
      request.ip
    );
  }
}
