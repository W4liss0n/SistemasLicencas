import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEmail,
  IsIn,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested
} from 'class-validator';

class AuthDeviceFingerprintDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      machine_id: 'MACHINE-A',
      disk_serial: 'DISK-A',
      mac_address: 'AA:BB:CC:DD:EE:01'
    }
  })
  @IsObject()
  @IsNotEmptyObject()
  raw_components!: Record<string, string>;
}

export class LoginRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  authorization_code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(43)
  code_verifier!: string;

  @ApiProperty({ example: 'http://127.0.0.1:53123/callback' })
  @IsString()
  @MinLength(10)
  redirect_uri!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  nonce!: string;

  @ApiProperty({ type: AuthDeviceFingerprintDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => AuthDeviceFingerprintDto)
  device_fingerprint!: AuthDeviceFingerprintDto;
}

export class RefreshRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  refresh_token!: string;

  @ApiProperty({ type: AuthDeviceFingerprintDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => AuthDeviceFingerprintDto)
  device_fingerprint!: AuthDeviceFingerprintDto;
}

export class OidcConfigResponseDto {
  @ApiProperty()
  issuer!: string;

  @ApiProperty()
  client_id!: string;

  @ApiProperty()
  authorization_endpoint!: string;

  @ApiProperty()
  token_endpoint!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  scopes!: string[];
}

export class LogoutRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  refresh_token!: string;
}

export class EntitlementDto {
  @ApiProperty()
  customer_id!: string;

  @ApiProperty()
  subscription_id!: string;

  @ApiProperty()
  plan_code!: string;

  @ApiProperty()
  plan_name!: string;

  @ApiProperty()
  program_id!: string;

  @ApiProperty()
  program_code!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  features!: string[];
}

export class LoginResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty()
  access_token!: string;

  @ApiProperty()
  access_expires_at!: string;

  @ApiProperty()
  refresh_token!: string;

  @ApiProperty()
  refresh_expires_at!: string;

  @ApiProperty()
  offline_token!: string;

  @ApiProperty()
  offline_expires_at!: string;

  @ApiProperty()
  server_time_ms!: number;

  @ApiProperty()
  max_offline_hours!: number;

  @ApiProperty({ type: [EntitlementDto] })
  entitlements!: EntitlementDto[];
}

export class RefreshResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty()
  access_token!: string;

  @ApiProperty()
  access_expires_at!: string;

  @ApiProperty()
  refresh_token!: string;

  @ApiProperty()
  refresh_expires_at!: string;

  @ApiProperty()
  offline_token!: string;

  @ApiProperty()
  offline_expires_at!: string;

  @ApiProperty()
  server_time_ms!: number;

  @ApiProperty()
  max_offline_hours!: number;

  @ApiProperty({ type: [EntitlementDto] })
  entitlements!: EntitlementDto[];
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  success!: true;
}

export class MeResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'string' },
      customer_id: { type: 'string' },
      identifier: { type: 'string' },
      status: { type: 'string', enum: ['active', 'blocked'] },
      last_login_at: { type: 'string', nullable: true }
    }
  })
  user!: {
    id: string;
    customer_id: string;
    identifier: string;
    status: 'active' | 'blocked';
    last_login_at: string | null;
  };

  @ApiProperty({ type: EntitlementDto })
  entitlement!: EntitlementDto;
}

export class AdminCreateUserRequestDto {
  @ApiProperty()
  @IsString()
  customer_id!: string;

  @ApiProperty({ example: 'user.new@example.com' })
  @IsEmail()
  identifier!: string;
}

export class AdminUpdateUserRequestDto {
  @ApiProperty({ required: false, example: 'user.updated@example.com' })
  @IsOptional()
  @IsEmail()
  identifier?: string;

  @ApiProperty({ required: false, enum: ['active', 'blocked'] })
  @IsOptional()
  @IsIn(['active', 'blocked'])
  status?: 'active' | 'blocked';
}

export class AdminUserResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'string' },
      customer_id: { type: 'string' },
      identifier: { type: 'string' },
      status: { type: 'string', enum: ['active', 'blocked'] },
      last_login_at: { type: 'string', nullable: true },
      created_at: { type: 'string' },
      updated_at: { type: 'string' }
    }
  })
  user!: {
    id: string;
    customer_id: string;
    identifier: string;
    status: 'active' | 'blocked';
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
  };
}
