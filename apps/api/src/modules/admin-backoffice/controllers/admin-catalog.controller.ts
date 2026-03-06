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
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import {
  AdminCreateCustomerResponseDto,
  AdminCustomerDetailsResponseDto,
  AdminCustomersListResponseDto,
  AdminOnboardCustomerResponseDto,
  AdminPlanResponseDto,
  AdminPlansListResponseDto,
  AdminProgramResponseDto,
  AdminProgramsListResponseDto,
  CreateCustomerRequestDto,
  CreatePlanRequestDto,
  CreateProgramRequestDto,
  OnboardCustomerRequestDto
} from '../dto/admin-backoffice.dto';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';
import { AdminBackofficeService } from '../services/admin-backoffice.service';
import { requireInternalIdempotencyKey } from '../utils/required-headers';

@ApiExcludeController()
@UseGuards(InternalApiKeyGuard)
@ApiHeader({ name: 'X-Internal-Api-Key', required: true })
@Controller('internal/admin')
export class AdminCatalogController {
  constructor(
    @Inject(AdminBackofficeService)
    private readonly adminBackofficeService: AdminBackofficeService
  ) {}

  @Post('programs')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async createProgram(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: CreateProgramRequestDto
  ): Promise<AdminProgramResponseDto> {
    const idempotencyKey = requireInternalIdempotencyKey(idempotencyKeyHeader);
    return this.adminBackofficeService.createProgram(payload, idempotencyKey);
  }

  @Get('programs')
  @HttpCode(200)
  async listPrograms(
    @Query('page') pageQuery: string | undefined,
    @Query('page_size') pageSizeQuery: string | undefined,
    @Query('q') query: string | undefined
  ): Promise<AdminProgramsListResponseDto> {
    return this.adminBackofficeService.listPrograms({
      page: parsePaginationParam(pageQuery, 1, 'page'),
      pageSize: parsePaginationParam(pageSizeQuery, 20, 'page_size', 100),
      query
    });
  }

  @Post('plans')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async createPlan(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: CreatePlanRequestDto
  ): Promise<AdminPlanResponseDto> {
    const idempotencyKey = requireInternalIdempotencyKey(idempotencyKeyHeader);
    return this.adminBackofficeService.createPlan(payload, idempotencyKey);
  }

  @Get('plans')
  @HttpCode(200)
  async listPlans(
    @Query('page') pageQuery: string | undefined,
    @Query('page_size') pageSizeQuery: string | undefined,
    @Query('q') query: string | undefined
  ): Promise<AdminPlansListResponseDto> {
    return this.adminBackofficeService.listPlans({
      page: parsePaginationParam(pageQuery, 1, 'page'),
      pageSize: parsePaginationParam(pageSizeQuery, 20, 'page_size', 100),
      query
    });
  }

  @Get('customers')
  @HttpCode(200)
  async listCustomers(
    @Query('page') pageQuery: string | undefined,
    @Query('page_size') pageSizeQuery: string | undefined,
    @Query('q') query: string | undefined
  ): Promise<AdminCustomersListResponseDto> {
    return this.adminBackofficeService.listCustomers({
      page: parsePaginationParam(pageQuery, 1, 'page'),
      pageSize: parsePaginationParam(pageSizeQuery, 20, 'page_size', 100),
      query
    });
  }

  @Get('customers/:customerId')
  @HttpCode(200)
  async getCustomerDetails(
    @Param('customerId') customerId: string
  ): Promise<AdminCustomerDetailsResponseDto> {
    return this.adminBackofficeService.getCustomerDetails(customerId);
  }

  @Post('customers')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async createCustomer(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: CreateCustomerRequestDto
  ): Promise<AdminCreateCustomerResponseDto> {
    const idempotencyKey = requireInternalIdempotencyKey(idempotencyKeyHeader);
    return this.adminBackofficeService.createCustomer(payload, idempotencyKey);
  }

  @Post('customers/onboard')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async onboardCustomer(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: OnboardCustomerRequestDto
  ): Promise<AdminOnboardCustomerResponseDto> {
    const idempotencyKey = requireInternalIdempotencyKey(idempotencyKeyHeader);
    return this.adminBackofficeService.onboardCustomer(payload, idempotencyKey);
  }
}

function parsePaginationParam(
  input: string | undefined,
  defaultValue: number,
  fieldName: string,
  maxValue?: number
): number {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return defaultValue;
  }

  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new DomainHttpError({
      status: HttpStatus.BAD_REQUEST,
      code: 'invalid_request',
      detail: `Query parameter ${fieldName} must be a positive integer`
    });
  }

  if (maxValue !== undefined && parsed > maxValue) {
    throw new DomainHttpError({
      status: HttpStatus.BAD_REQUEST,
      code: 'invalid_request',
      detail: `Query parameter ${fieldName} must be <= ${maxValue}`
    });
  }

  return parsed;
}
