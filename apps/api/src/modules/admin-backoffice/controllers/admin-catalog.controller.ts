import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
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
  OnboardCustomerRequestDto,
  UpdatePlanRequestDto
} from '../dto/admin-backoffice.dto';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';
import { AdminCatalogApplicationService } from '../services/application/admin-catalog-application.service';
import { AdminCustomersApplicationService } from '../services/application/admin-customers-application.service';
import {
  toCreateCustomerCommand,
  toCreatePlanCommand,
  toCreateProgramCommand,
  toOnboardCustomerCommand,
  toUpdatePlanCommand
} from './admin-backoffice-command.mapper';
import { requireInternalIdempotencyKey } from '../utils/required-headers';

@ApiExcludeController()
@UseGuards(InternalApiKeyGuard)
@ApiHeader({ name: 'X-Internal-Api-Key', required: true })
@Controller('internal/admin')
export class AdminCatalogController {
  constructor(
    @Inject(AdminCatalogApplicationService)
    private readonly catalogService: AdminCatalogApplicationService,
    @Inject(AdminCustomersApplicationService)
    private readonly customersService: AdminCustomersApplicationService
  ) {}

  @Post('programs')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async createProgram(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: CreateProgramRequestDto
  ): Promise<AdminProgramResponseDto> {
    const idempotencyKey = requireInternalIdempotencyKey(idempotencyKeyHeader);
    return this.catalogService.createProgram(toCreateProgramCommand(payload), idempotencyKey);
  }

  @Get('programs')
  @HttpCode(200)
  async listPrograms(
    @Query('page') pageQuery: string | undefined,
    @Query('page_size') pageSizeQuery: string | undefined,
    @Query('q') query: string | undefined
  ): Promise<AdminProgramsListResponseDto> {
    return this.catalogService.listPrograms({
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
    return this.catalogService.createPlan(toCreatePlanCommand(payload), idempotencyKey);
  }

  @Get('plans')
  @HttpCode(200)
  async listPlans(
    @Query('page') pageQuery: string | undefined,
    @Query('page_size') pageSizeQuery: string | undefined,
    @Query('q') query: string | undefined
  ): Promise<AdminPlansListResponseDto> {
    return this.catalogService.listPlans({
      page: parsePaginationParam(pageQuery, 1, 'page'),
      pageSize: parsePaginationParam(pageSizeQuery, 20, 'page_size', 100),
      query
    });
  }

  @Patch('plans/:planId')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async updatePlan(
    @Param('planId') planId: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: UpdatePlanRequestDto
  ): Promise<AdminPlanResponseDto> {
    const idempotencyKey = requireInternalIdempotencyKey(idempotencyKeyHeader);
    return this.catalogService.updatePlan(toUpdatePlanCommand(planId, payload), idempotencyKey);
  }

  @Get('customers')
  @HttpCode(200)
  async listCustomers(
    @Query('page') pageQuery: string | undefined,
    @Query('page_size') pageSizeQuery: string | undefined,
    @Query('q') query: string | undefined
  ): Promise<AdminCustomersListResponseDto> {
    return this.customersService.listCustomers({
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
    return this.customersService.getCustomerDetails(customerId);
  }

  @Post('customers')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async createCustomer(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: CreateCustomerRequestDto
  ): Promise<AdminCreateCustomerResponseDto> {
    const idempotencyKey = requireInternalIdempotencyKey(idempotencyKeyHeader);
    return this.customersService.createCustomer(toCreateCustomerCommand(payload), idempotencyKey);
  }

  @Post('customers/onboard')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async onboardCustomer(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() payload: OnboardCustomerRequestDto
  ): Promise<AdminOnboardCustomerResponseDto> {
    const idempotencyKey = requireInternalIdempotencyKey(idempotencyKeyHeader);
    return this.customersService.onboardCustomer(toOnboardCustomerCommand(payload), idempotencyKey);
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
