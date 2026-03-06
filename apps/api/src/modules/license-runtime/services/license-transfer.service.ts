import { Inject, Injectable } from '@nestjs/common';
import {
  TransferLicenseRequestDto,
  TransferLicenseResponseDto
} from '../dto/license.dto';
import { LICENSE_ENGINE_PORT, LicenseEnginePort } from '../ports/license-engine.port';
import { throwFromLicenseEngineFailure } from './license-error.mapper';
import { IdempotencyService } from './idempotency.service';
import {
  AUDIT_SECURITY_PORT,
  AuditSecurityPort
} from '../../audit-security/ports/audit-security.port';

@Injectable()
export class LicenseTransferService {
  private static readonly ENDPOINT = '/api/v2/licenses/transfer';

  constructor(
    @Inject(LICENSE_ENGINE_PORT)
    private readonly licenseEngine: LicenseEnginePort,
    @Inject(AUDIT_SECURITY_PORT)
    private readonly auditRepository: AuditSecurityPort,
    @Inject(IdempotencyService)
    private readonly idempotencyService: IdempotencyService
  ) {}

  async transfer(
    programId: string,
    payload: TransferLicenseRequestDto,
    idempotencyKey: string,
    ipAddress?: string
  ): Promise<TransferLicenseResponseDto> {
    const execution = await this.idempotencyService.execute<TransferLicenseResponseDto>({
      endpoint: LicenseTransferService.ENDPOINT,
      idempotencyKey,
      payload: { programId, ...payload },
      execute: async () => {
        const result = await this.licenseEngine.transfer({
          licenseKey: payload.license_key,
          programId,
          newFingerprint: payload.new_device_fingerprint.raw_components,
          reason: payload.reason,
          ipAddress
        });

        if (!result.ok) {
          await this.auditRepository.writeValidationHistory({
            licenseKey: payload.license_key,
            success: false,
            errorCode: result.code,
            metadata: {
              reason: result.detail,
              action: 'transfer'
            }
          });

          throwFromLicenseEngineFailure(result);
        }

        await this.auditRepository.writeValidationHistory({
          licenseKey: payload.license_key,
          success: true,
          metadata: {
            action: 'transfer',
            program_id: programId,
            reason: payload.reason
          }
        });

        await this.auditRepository.writeAuditLog({
          entityType: 'license',
          entityId: payload.license_key,
          action: 'transfer',
          payload: {
            program_id: programId,
            reason: payload.reason,
            transfer_count_month: result.transferCountMonth
          }
        });

        return {
          statusCode: 200,
          body: {
            success: true,
            transfer_count_month: result.transferCountMonth,
            message: result.message
          }
        };
      }
    });

    return execution.body;
  }
}
