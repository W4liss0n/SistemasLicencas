import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_BACKOFFICE_PORT,
  type AdminBackofficePort,
  type AdminLicenseDetails
} from '../../ports/admin-backoffice.port';
import type { AdminLicenseResponseDto } from '../../dto/admin-backoffice.dto';
import { IdempotencyService } from '../../../license-runtime/services/idempotency.service';
import { ADMIN_BACKOFFICE_ENDPOINTS } from '../admin-backoffice-endpoints';
import { toLicenseResponseDto } from '../admin-backoffice-response.mapper';
import type {
  LicenseActionCommand,
  ProvisionLicenseCommand,
  RenewLicenseCommand,
  UpdateLicenseCommand
} from './admin-backoffice.commands';

@Injectable()
export class AdminLicensesApplicationService {
  constructor(
    @Inject(ADMIN_BACKOFFICE_PORT) private readonly adminBackoffice: AdminBackofficePort,
    @Inject(IdempotencyService) private readonly idempotencyService: IdempotencyService
  ) {}

  async provision(
    command: ProvisionLicenseCommand,
    idempotencyKey: string
  ): Promise<AdminLicenseResponseDto> {
    const execution = await this.idempotencyService.execute<AdminLicenseResponseDto>({
      endpoint: ADMIN_BACKOFFICE_ENDPOINTS.provision,
      idempotencyKey,
      payload: command,
      execute: async () => {
        const result = await this.adminBackoffice.provisionLicense({
          programCode: command.programCode,
          planCode: command.planCode,
          customer: command.customer,
          subscription: {
            endAt: command.subscriptionEndAt,
            startAt: command.subscriptionStartAt,
            autoRenew: command.autoRenew
          },
          maxOfflineHours: command.maxOfflineHours,
          metadata: command.metadata,
          requestedBy: command.requestedBy
        });

        return {
          statusCode: 200,
          body: toLicenseResponseDto(result)
        };
      }
    });

    return execution.body;
  }

  async renew(
    command: RenewLicenseCommand,
    idempotencyKey: string
  ): Promise<AdminLicenseResponseDto> {
    const execution = await this.idempotencyService.execute<AdminLicenseResponseDto>({
      endpoint: ADMIN_BACKOFFICE_ENDPOINTS.renew(command.licenseKey),
      idempotencyKey,
      payload: command,
      execute: async () => {
        const result = await this.adminBackoffice.renewLicense(command);

        return {
          statusCode: 200,
          body: toLicenseResponseDto(result)
        };
      }
    });

    return execution.body;
  }

  async updateLicense(
    command: UpdateLicenseCommand,
    idempotencyKey: string
  ): Promise<AdminLicenseResponseDto> {
    const execution = await this.idempotencyService.execute<AdminLicenseResponseDto>({
      endpoint: ADMIN_BACKOFFICE_ENDPOINTS.updateLicense(command.licenseKey),
      idempotencyKey,
      payload: command,
      execute: async () => {
        const result = await this.adminBackoffice.updateLicense(command);

        return {
          statusCode: 200,
          body: toLicenseResponseDto(result)
        };
      }
    });

    return execution.body;
  }

  async block(
    command: LicenseActionCommand,
    idempotencyKey: string
  ): Promise<AdminLicenseResponseDto> {
    return this.runLicenseAction(
      ADMIN_BACKOFFICE_ENDPOINTS.block(command.licenseKey),
      command,
      idempotencyKey,
      (input) => this.adminBackoffice.blockLicense(input)
    );
  }

  async unblock(
    command: LicenseActionCommand,
    idempotencyKey: string
  ): Promise<AdminLicenseResponseDto> {
    return this.runLicenseAction(
      ADMIN_BACKOFFICE_ENDPOINTS.unblock(command.licenseKey),
      command,
      idempotencyKey,
      (input) => this.adminBackoffice.unblockLicense(input)
    );
  }

  async cancel(
    command: LicenseActionCommand,
    idempotencyKey: string
  ): Promise<AdminLicenseResponseDto> {
    return this.runLicenseAction(
      ADMIN_BACKOFFICE_ENDPOINTS.cancel(command.licenseKey),
      command,
      idempotencyKey,
      (input) => this.adminBackoffice.cancelLicense(input)
    );
  }

  async getLicenseDetails(licenseKey: string): Promise<AdminLicenseResponseDto> {
    const result = await this.adminBackoffice.getLicenseDetails({ licenseKey });
    return toLicenseResponseDto(result);
  }

  private async runLicenseAction(
    endpoint: string,
    command: LicenseActionCommand,
    idempotencyKey: string,
    execute: (input: {
      licenseKey: string;
      requestedBy?: string;
      reason?: string;
    }) => Promise<AdminLicenseDetails>
  ): Promise<AdminLicenseResponseDto> {
    const execution = await this.idempotencyService.execute<AdminLicenseResponseDto>({
      endpoint,
      idempotencyKey,
      payload: command,
      execute: async () => {
        const result = await execute(command);

        return {
          statusCode: 200,
          body: toLicenseResponseDto(result)
        };
      }
    });

    return execution.body;
  }
}
