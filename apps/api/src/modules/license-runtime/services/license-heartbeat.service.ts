import { Inject, Injectable } from '@nestjs/common';
import { HeartbeatRequestDto, HeartbeatResponseDto } from '../dto/license.dto';
import { LICENSE_ENGINE_PORT, LicenseEnginePort } from '../ports/license-engine.port';
import { throwFromLicenseEngineFailure } from './license-error.mapper';
import {
  AUDIT_SECURITY_PORT,
  AuditSecurityPort
} from '../../audit-security/ports/audit-security.port';

@Injectable()
export class LicenseHeartbeatService {
  constructor(
    @Inject(LICENSE_ENGINE_PORT)
    private readonly licenseEngine: LicenseEnginePort,
    @Inject(AUDIT_SECURITY_PORT)
    private readonly auditRepository: AuditSecurityPort
  ) {}

  async heartbeat(
    programId: string,
    payload: HeartbeatRequestDto,
    ipAddress?: string
  ): Promise<HeartbeatResponseDto> {
    const result = await this.licenseEngine.heartbeat({
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
          action: 'heartbeat'
        }
      });

      throwFromLicenseEngineFailure(result);
    }

    await this.auditRepository.writeValidationHistory({
      licenseKey: payload.license_key,
      success: true,
      metadata: {
        action: 'heartbeat',
        program_id: programId
      }
    });

    return {
      success: true,
      next_heartbeat: result.nextHeartbeat,
      server_time: result.serverTime
    };
  }
}
