import { Inject, Injectable } from '@nestjs/common';
import {
  ActivateLicenseResponseDto,
  ActivateLicenseRequestDto
} from '../dto/license.dto';
import { LICENSE_ENGINE_PORT, LicenseEnginePort } from '../ports/license-engine.port';
import { throwFromLicenseEngineFailure } from './license-error.mapper';
import { IdempotencyService } from './idempotency.service';
import {
  AUDIT_SECURITY_PORT,
  AuditSecurityPort
} from '../../audit-security/ports/audit-security.port';

@Injectable()
export class LicenseActivationService {
  private static readonly ENDPOINT = '/api/v2/licenses/activate';

  constructor(
    @Inject(LICENSE_ENGINE_PORT)
    private readonly licenseEngine: LicenseEnginePort,
    @Inject(AUDIT_SECURITY_PORT)
    private readonly auditRepository: AuditSecurityPort,
    @Inject(IdempotencyService)
    private readonly idempotencyService: IdempotencyService
  ) {}

  async activate(
    programId: string,
    payload: ActivateLicenseRequestDto,
    idempotencyKey: string,
    ipAddress?: string
  ): Promise<ActivateLicenseResponseDto> {
    const execution = await this.idempotencyService.execute<ActivateLicenseResponseDto>({
      endpoint: LicenseActivationService.ENDPOINT,
      idempotencyKey,
      payload: { programId, ...payload },
      execute: async () => {
        const result = await this.licenseEngine.activate({
          licenseKey: payload.license_key,
          programId,
          fingerprint: payload.device_fingerprint.raw_components,
          programVersion: payload.program_version,
          osInfo: payload.os_info,
          ipAddress
        });

        if (!result.ok) {
          await this.auditRepository.writeValidationHistory({
            licenseKey: payload.license_key,
            success: false,
            errorCode: result.code,
            metadata: {
              reason: result.detail,
              action: 'activate'
            }
          });

          throwFromLicenseEngineFailure(result);
        }

        await this.auditRepository.writeValidationHistory({
          licenseKey: payload.license_key,
          success: true,
          metadata: {
            action: 'activate',
            program_id: programId
          }
        });

        await this.auditRepository.writeAuditLog({
          entityType: 'license',
          entityId: payload.license_key,
          action: 'activate',
          payload: {
            program_id: programId
          }
        });

        return {
          statusCode: 200,
          body: {
            success: true,
            valid: true,
            license_info: {
              license_key: result.licenseInfo.licenseKey,
              expiration: result.licenseInfo.expiration,
              plan_name: result.licenseInfo.planName,
              max_offline_hours: result.licenseInfo.maxOfflineHours,
              features: result.licenseInfo.features
            },
            offline_token: result.offlineToken,
            security: {
              risk_score: result.security.riskScore,
              warnings: result.security.warnings,
              next_heartbeat: result.security.nextHeartbeat
            }
          }
        };
      }
    });

    return execution.body;
  }
}
