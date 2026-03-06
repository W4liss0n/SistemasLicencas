import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { ApiExcludeController, ApiHeader } from '@nestjs/swagger';
import {
  AdminLicenseResponseDto,
  AdminOperationalSummaryResponseDto,
  LicenseActionRequestDto,
  ProvisionLicenseRequestDto,
  RenewLicenseRequestDto
} from '../dto/admin-backoffice.dto';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';
import { AdminBackofficeService } from '../services/admin-backoffice.service';
import { requireInternalIdempotencyKey } from '../utils/required-headers';
import { DomainHttpError } from '../../../common/errors/domain-http-error';

@ApiExcludeController()
@UseGuards(InternalApiKeyGuard)
@ApiHeader({ name: 'X-Internal-Api-Key', required: true })
@Controller('internal/admin')
export class AdminBackofficeController {
  constructor(
    @Inject(AdminBackofficeService)
    private readonly adminBackofficeService: AdminBackofficeService
  ) {}

  @Post('licenses')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async provisionLicense(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: ProvisionLicenseRequestDto
  ): Promise<AdminLicenseResponseDto> {
    const idempotencyKey = requireInternalIdempotencyKey(idempotencyKeyHeader);
    return this.adminBackofficeService.provision(payload, idempotencyKey);
  }

  @Post('licenses/:licenseKey/renew')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async renewLicense(
    @Param('licenseKey') licenseKey: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: RenewLicenseRequestDto
  ): Promise<AdminLicenseResponseDto> {
    const idempotencyKey = requireInternalIdempotencyKey(idempotencyKeyHeader);
    return this.adminBackofficeService.renew(licenseKey, payload, idempotencyKey);
  }

  @Post('licenses/:licenseKey/block')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async blockLicense(
    @Param('licenseKey') licenseKey: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: LicenseActionRequestDto
  ): Promise<AdminLicenseResponseDto> {
    const idempotencyKey = requireInternalIdempotencyKey(idempotencyKeyHeader);
    return this.adminBackofficeService.block(licenseKey, payload, idempotencyKey);
  }

  @Post('licenses/:licenseKey/unblock')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async unblockLicense(
    @Param('licenseKey') licenseKey: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: LicenseActionRequestDto
  ): Promise<AdminLicenseResponseDto> {
    const idempotencyKey = requireInternalIdempotencyKey(idempotencyKeyHeader);
    return this.adminBackofficeService.unblock(licenseKey, payload, idempotencyKey);
  }

  @Post('licenses/:licenseKey/cancel')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async cancelLicense(
    @Param('licenseKey') licenseKey: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: LicenseActionRequestDto
  ): Promise<AdminLicenseResponseDto> {
    const idempotencyKey = requireInternalIdempotencyKey(idempotencyKeyHeader);
    return this.adminBackofficeService.cancel(licenseKey, payload, idempotencyKey);
  }

  @Get('licenses/:licenseKey')
  @HttpCode(200)
  async getLicenseDetails(
    @Param('licenseKey') licenseKey: string
  ): Promise<AdminLicenseResponseDto> {
    return this.adminBackofficeService.getLicenseDetails(licenseKey);
  }

  @Get('operational-summary')
  @HttpCode(200)
  async getOperationalSummary(
    @Query('window_days') windowDaysQuery: string | undefined
  ): Promise<AdminOperationalSummaryResponseDto> {
    let windowDays: number | undefined;
    if (typeof windowDaysQuery === 'string' && windowDaysQuery.trim().length > 0) {
      const parsed = Number(windowDaysQuery);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new DomainHttpError({
          status: HttpStatus.BAD_REQUEST,
          code: 'invalid_request',
          detail: 'Query parameter window_days must be a positive integer'
        });
      }
      windowDays = parsed;
    }
    return this.adminBackofficeService.getOperationalSummary(windowDays);
  }
}
