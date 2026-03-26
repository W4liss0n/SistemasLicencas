import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_BACKOFFICE_PORT, type AdminBackofficePort } from '../../ports/admin-backoffice.port';
import type {
  AdminCreateCustomerResponseDto,
  AdminCustomerDetailsResponseDto,
  AdminCustomersListResponseDto,
  AdminOnboardCustomerResponseDto
} from '../../dto/admin-backoffice.dto';
import { IdempotencyService } from '../../../license-runtime/services/idempotency.service';
import { ADMIN_BACKOFFICE_ENDPOINTS } from '../admin-backoffice-endpoints';
import {
  toCreateCustomerResponseDto,
  toCustomerDetailsResponseDto,
  toCustomersListResponseDto,
  toOnboardCustomerResponseDto
} from '../admin-backoffice-response.mapper';
import type {
  CreateCustomerCommand,
  OnboardCustomerCommand
} from './admin-backoffice.commands';

@Injectable()
export class AdminCustomersApplicationService {
  constructor(
    @Inject(ADMIN_BACKOFFICE_PORT) private readonly adminBackoffice: AdminBackofficePort,
    @Inject(IdempotencyService) private readonly idempotencyService: IdempotencyService
  ) {}

  async listCustomers(input: {
    page: number;
    pageSize: number;
    query?: string;
  }): Promise<AdminCustomersListResponseDto> {
    const result = await this.adminBackoffice.listCustomers(input);
    return toCustomersListResponseDto(result);
  }

  async getCustomerDetails(customerId: string): Promise<AdminCustomerDetailsResponseDto> {
    const result = await this.adminBackoffice.getCustomerDetails({ customerId });
    return toCustomerDetailsResponseDto(result);
  }

  async createCustomer(
    command: CreateCustomerCommand,
    idempotencyKey: string
  ): Promise<AdminCreateCustomerResponseDto> {
    const execution = await this.idempotencyService.execute<AdminCreateCustomerResponseDto>({
      endpoint: ADMIN_BACKOFFICE_ENDPOINTS.createCustomer,
      idempotencyKey,
      payload: command,
      execute: async () => {
        const result = await this.adminBackoffice.createCustomer(command);

        return {
          statusCode: 200,
          body: toCreateCustomerResponseDto(result)
        };
      }
    });

    return execution.body;
  }

  async onboardCustomer(
    command: OnboardCustomerCommand,
    idempotencyKey: string
  ): Promise<AdminOnboardCustomerResponseDto> {
    const execution = await this.idempotencyService.execute<AdminOnboardCustomerResponseDto>({
      endpoint: ADMIN_BACKOFFICE_ENDPOINTS.onboardCustomer,
      idempotencyKey,
      payload: command,
      execute: async () => {
        const result = await this.adminBackoffice.onboardCustomer(command);

        return {
          statusCode: 200,
          body: toOnboardCustomerResponseDto(result)
        };
      }
    });

    return execution.body;
  }
}
