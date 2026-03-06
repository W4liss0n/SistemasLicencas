import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthenticateRequestDto {
  @ApiProperty({ example: 'demo@example.com' })
  @IsString()
  @MinLength(3)
  identifier!: string;

  @ApiProperty({ example: 'demo123' })
  @IsString()
  @MinLength(6)
  password!: string;
}

export class AuthenticateResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'access-token-value' })
  access_token!: string;

  @ApiProperty({ example: '2026-03-04T16:00:00.000Z' })
  issued_at!: string;

  @ApiProperty({ example: '2026-03-04T20:00:00.000Z' })
  expires_at!: string;

  @ApiProperty({ example: '01abc' })
  trace_id!: string;
}

export class AuthenticatePublicResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'access-token-value' })
  access_token!: string;

  @ApiProperty({ example: '2026-03-04T16:00:00.000Z' })
  issued_at!: string;

  @ApiProperty({ example: '2026-03-04T20:00:00.000Z' })
  expires_at!: string;
}

export class DeviceFingerprintDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      machine_id: 'ABC-123',
      disk_serial: 'DISK-001',
      mac_address: 'AA:BB:CC:DD:EE:FF'
    }
  })
  @IsObject()
  @IsNotEmptyObject()
  raw_components!: Record<string, string>;
}

export class ValidateLicenseRequestDto {
  @ApiProperty({ example: 'LIC-AAAA-BBBB-CCCC-DDDD' })
  @IsString()
  @MinLength(8)
  license_key!: string;

  @ApiProperty({ type: DeviceFingerprintDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => DeviceFingerprintDto)
  device_fingerprint!: DeviceFingerprintDto;

  @ApiProperty({ required: false, example: '2.3.1' })
  @IsOptional()
  @IsString()
  program_version?: string;

  @ApiProperty({ required: false, example: 'Windows 11' })
  @IsOptional()
  @IsString()
  os_info?: string;
}

export class ActivateLicenseRequestDto extends ValidateLicenseRequestDto {}

export class HeartbeatRequestDto extends ValidateLicenseRequestDto {}

export class LicenseInfoDto {
  @ApiProperty({ example: 'LIC-AAAA-BBBB-CCCC-DDDD' })
  license_key!: string;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z' })
  expiration!: string;

  @ApiProperty({ example: 'pro' })
  plan_name!: string;

  @ApiProperty({ example: 72 })
  max_offline_hours!: number;

  @ApiProperty({ type: [String], example: ['dashboard', 'offline_mode'] })
  features!: string[];
}

export class ValidationSecurityDto {
  @ApiProperty({ example: 12 })
  risk_score!: number;

  @ApiProperty({ type: [String], example: [] })
  warnings!: string[];

  @ApiProperty({ example: 300 })
  next_heartbeat!: number;
}

export class ValidateLicenseResponseDto {
  @ApiProperty({ example: true })
  valid!: true;

  @ApiProperty({ type: LicenseInfoDto })
  license_info!: LicenseInfoDto;

  @ApiProperty({ example: 'offline-token-value' })
  offline_token!: string;

  @ApiProperty({ type: ValidationSecurityDto })
  security!: ValidationSecurityDto;
}

export class ActivateLicenseResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: true })
  valid!: true;

  @ApiProperty({ type: LicenseInfoDto })
  license_info!: LicenseInfoDto;

  @ApiProperty({ example: 'offline-token-value' })
  offline_token!: string;

  @ApiProperty({ type: ValidationSecurityDto })
  security!: ValidationSecurityDto;
}

export class HeartbeatResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 3600 })
  next_heartbeat!: number;

  @ApiProperty({ example: 1762201200000 })
  server_time!: number;
}

export class TransferLicenseRequestDto {
  @ApiProperty({ example: 'LIC-AAAA-BBBB-CCCC-DDDD' })
  @IsString()
  @MinLength(8)
  license_key!: string;

  @ApiProperty({ type: DeviceFingerprintDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => DeviceFingerprintDto)
  new_device_fingerprint!: DeviceFingerprintDto;

  @ApiProperty({ required: false, example: 'device_replacement' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class TransferLicenseResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 1 })
  transfer_count_month!: number;

  @ApiProperty({ example: 'License transferred successfully' })
  message!: string;
}

export class DeactivateLicenseRequestDto {
  @ApiProperty({ example: 'LIC-AAAA-BBBB-CCCC-DDDD' })
  @IsString()
  @MinLength(8)
  license_key!: string;

  @ApiProperty({ type: DeviceFingerprintDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => DeviceFingerprintDto)
  device_fingerprint!: DeviceFingerprintDto;
}

export class DeactivateLicenseResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Device deactivated successfully' })
  message!: string;
}
