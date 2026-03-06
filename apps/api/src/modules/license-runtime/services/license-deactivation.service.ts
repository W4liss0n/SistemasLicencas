import { Inject, Injectable } from '@nestjs/common';
import {
  DeactivateLicenseRequestDto,
  DeactivateLicenseResponseDto
} from '../dto/license.dto';
import { LICENSE_ENGINE_PORT, LicenseEnginePort } from '../ports/license-engine.port';
import { throwFromLicenseEngineFailure } from './license-error.mapper';
import { IdempotencyService } from './idempotency.service';
import {
  AUDIT_SECURITY_PORT,
  AuditSecurityPort
} from '../../audit-security/ports/audit-security.port';

@Injectable()
export class LicenseDeactivationService {
  private static readonly ENDPOINT = '/api/v2/licenses/deactivate';

  constructor(
    @Inject(LICENSE_ENGINE_PORT)
    private readonly licenseEngine: LicenseEnginePort,
    @Inject(AUDIT_SECURITY_PORT)
    private readonly auditRepository: AuditSecurityPort,
    @Inject(IdempotencyService)
    private readonly idempotencyService: IdempotencyService
  ) {}

  async deactivate(
    programId: string,
    payload: DeactivateLicenseRequestDto,
    idempotencyKey: string,
    ipAddress?: string
  ): Promise<DeactivateLicenseResponseDto> {
    const execution = await this.idempotencyService.execute<DeactivateLicenseResponseDto>({
      endpoint: LicenseDeactivationService.ENDPOINT,
      idempotencyKey,
      payload: { programId, ...payload },
      execute: async () => {
        const result = await this.licenseEngine.deactivate({
          licenseKey: payload.license_key,
          programId,
          fingerprint: payload.device_fingerprint.raw_components,
          ipAddress
        });

        if (!result.ok) {
          await this.auditRepository.writeValidationHistory({
            licenseKey: payload.license_key,
            success: false,
            errorCode: result.code,
            metadata: {
              reason: result.detail,
              action: 'deactivate'
            }
          });

          throwFromLicenseEngineFailure(result);
        }

        await this.auditRepository.writeValidationHistory({
          licenseKey: payload.license_key,
          success: true,
          metadata: {
            action: 'deactivate',
            program_id: programId
          }
        });

        await this.auditRepository.writeAuditLog({
          entityType: 'license',
          entityId: payload.license_key,
          action: 'deactivate',
          payload: {
            program_id: programId
          }
        });

        return {
          statusCode: 200,
          body: {
            success: true,
            message: result.message
          }
        };
      }
    });

    return execution.body;
  }
}
