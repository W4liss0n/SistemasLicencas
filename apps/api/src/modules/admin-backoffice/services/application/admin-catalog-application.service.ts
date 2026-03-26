import { Inject, Injectable } from '@nestjs/common';
import type {
  AdminBackofficePort,
  ListPlansInput,
  ListProgramsInput
} from '../../ports/admin-backoffice.port';
import type {
  AdminPlanResponseDto,
  AdminPlansListResponseDto,
  AdminProgramResponseDto,
  AdminProgramsListResponseDto
} from '../../dto/admin-backoffice.dto';
import { ADMIN_BACKOFFICE_PORT } from '../../ports/admin-backoffice.port';
import { IdempotencyService } from '../../../license-runtime/services/idempotency.service';
import { ADMIN_BACKOFFICE_ENDPOINTS } from '../admin-backoffice-endpoints';
import {
  toPlanResponseDto,
  toPlansListResponseDto,
  toProgramResponseDto,
  toProgramsListResponseDto
} from '../admin-backoffice-response.mapper';
import type {
  CreatePlanCommand,
  CreateProgramCommand,
  UpdatePlanCommand
} from './admin-backoffice.commands';

@Injectable()
export class AdminCatalogApplicationService {
  constructor(
    @Inject(ADMIN_BACKOFFICE_PORT) private readonly adminBackoffice: AdminBackofficePort,
    @Inject(IdempotencyService) private readonly idempotencyService: IdempotencyService
  ) {}

  async createProgram(
    command: CreateProgramCommand,
    idempotencyKey: string
  ): Promise<AdminProgramResponseDto> {
    const execution = await this.idempotencyService.execute<AdminProgramResponseDto>({
      endpoint: ADMIN_BACKOFFICE_ENDPOINTS.createProgram,
      idempotencyKey,
      payload: command,
      execute: async () => {
        const program = await this.adminBackoffice.createProgram(command);

        return {
          statusCode: 200,
          body: toProgramResponseDto(program)
        };
      }
    });

    return execution.body;
  }

  async listPrograms(input: ListProgramsInput): Promise<AdminProgramsListResponseDto> {
    const result = await this.adminBackoffice.listPrograms(input);
    return toProgramsListResponseDto(result);
  }

  async createPlan(
    command: CreatePlanCommand,
    idempotencyKey: string
  ): Promise<AdminPlanResponseDto> {
    const execution = await this.idempotencyService.execute<AdminPlanResponseDto>({
      endpoint: ADMIN_BACKOFFICE_ENDPOINTS.createPlan,
      idempotencyKey,
      payload: command,
      execute: async () => {
        const plan = await this.adminBackoffice.createPlan(command);

        return {
          statusCode: 200,
          body: toPlanResponseDto(plan)
        };
      }
    });

    return execution.body;
  }

  async listPlans(input: ListPlansInput): Promise<AdminPlansListResponseDto> {
    const result = await this.adminBackoffice.listPlans(input);
    return toPlansListResponseDto(result);
  }

  async updatePlan(
    command: UpdatePlanCommand,
    idempotencyKey: string
  ): Promise<AdminPlanResponseDto> {
    const execution = await this.idempotencyService.execute<AdminPlanResponseDto>({
      endpoint: ADMIN_BACKOFFICE_ENDPOINTS.updatePlan(command.planId),
      idempotencyKey,
      payload: command,
      execute: async () => {
        const plan = await this.adminBackoffice.updatePlan(command);

        return {
          statusCode: 200,
          body: toPlanResponseDto(plan)
        };
      }
    });

    return execution.body;
  }
}
