import { Inject, Injectable } from '@nestjs/common';
import {
  LICENSE_ENGINE_PORT,
  LicenseEnginePort,
  ValidateLicenseResult
} from '../ports/license-engine.port';
import { ValidateLicenseRequestDto } from '../dto/license.dto';
import {
  AUDIT_SECURITY_PORT,
  AuditSecurityPort
} from '../../audit-security/ports/audit-security.port';
import { throwFromLicenseEngineFailure } from './license-error.mapper';

@Injectable()
export class LicenseValidationService {
  constructor(
    @Inject(LICENSE_ENGINE_PORT)
    private readonly licenseEngine: LicenseEnginePort,
    @Inject(AUDIT_SECURITY_PORT)
    private readonly auditRepository: AuditSecurityPort
  ) {}

  async validate(
    programId: string,
    payload: ValidateLicenseRequestDto,
    ipAddress?: string
  ): Promise<{
    valid: true;
    license_info: {
      license_key: string;
      expiration: string;
      plan_name: string;
      max_offline_hours: number;
      features: string[];
    };
    offline_token: string;
    security: {
      risk_score: number;
      warnings: string[];
      next_heartbeat: number;
    };
  }> {
    const result: ValidateLicenseResult = await this.licenseEngine.validate({
      licenseKey: payload.license_key,
      programId,
      programVersion: payload.program_version,
      osInfo: payload.os_info,
      fingerprint: payload.device_fingerprint.raw_components,
      ipAddress
    });

    if (!result.ok) {
      await this.auditRepository.writeValidationHistory({
        licenseKey: payload.license_key,
        success: false,
        errorCode: result.code,
        metadata: {
          reason: result.detail
        }
      });

      await this.auditRepository.writeSecurityEvent({
        eventType: 'license_validation_failed',
        severity: 'medium',
        details: {
          code: result.code,
          license_key: payload.license_key
        }
      });

      throwFromLicenseEngineFailure(result);
    }

    await this.auditRepository.writeValidationHistory({
      licenseKey: payload.license_key,
      success: true,
      metadata: {
        program_version: payload.program_version,
        os_info: payload.os_info
      }
    });

    return {
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
    };
  }
}
