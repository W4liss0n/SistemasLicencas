import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

export class AdminCustomerDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  document?: string;
}

export class ProvisionLicenseRequestDto {
  @IsString()
  @MinLength(2)
  program_code!: string;

  @IsString()
  @MinLength(2)
  plan_code!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => AdminCustomerDto)
  customer!: AdminCustomerDto;

  @IsString()
  subscription_end_at!: string;

  @IsOptional()
  @IsString()
  subscription_start_at?: string;

  @IsOptional()
  @IsBoolean()
  auto_renew?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_offline_hours?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  requested_by?: string;
}

export class RenewLicenseRequestDto {
  @IsString()
  new_end_at!: string;

  @IsOptional()
  @IsString()
  requested_by?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class LicenseActionRequestDto {
  @IsOptional()
  @IsString()
  requested_by?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateProgramRequestDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  requested_by?: string;
}

export class CreatePlanRequestDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  max_devices!: number;

  @IsInt()
  @Min(1)
  @Max(24 * 365)
  max_offline_hours!: number;

  @IsArray()
  @IsString({ each: true })
  features!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  program_ids!: string[];

  @IsOptional()
  @IsString()
  requested_by?: string;
}

export class CreateCustomerRequestDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => AdminCustomerDto)
  customer!: AdminCustomerDto;

  @IsOptional()
  @IsString()
  requested_by?: string;
}

export class OnboardCustomerRequestDto {
  @IsString()
  @IsIn(['plan', 'individual_program'])
  selection_mode!: 'plan' | 'individual_program';

  @IsDefined()
  @ValidateNested()
  @Type(() => AdminCustomerDto)
  customer!: AdminCustomerDto;

  @IsOptional()
  @IsUUID('4')
  program_id?: string;

  @IsOptional()
  @IsUUID('4')
  plan_id?: string;

  @IsString()
  subscription_end_at!: string;

  @IsOptional()
  @IsString()
  subscription_start_at?: string;

  @IsOptional()
  @IsBoolean()
  auto_renew?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_offline_hours?: number;

  @IsOptional()
  @IsString()
  requested_by?: string;
}

export type AdminProgramDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AdminProgramResponseDto = {
  success: true;
  program: AdminProgramDto;
};

export type AdminProgramsListResponseDto = {
  success: true;
  items: AdminProgramDto[];
  page: number;
  page_size: number;
  total: number;
};

export type AdminPlanDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  max_devices: number;
  max_offline_hours: number;
  features: string[];
  created_at: string;
  updated_at: string;
  programs: AdminProgramDto[];
};

export type AdminPlanResponseDto = {
  success: true;
  plan: AdminPlanDto;
};

export type AdminPlansListResponseDto = {
  success: true;
  items: AdminPlanDto[];
  page: number;
  page_size: number;
  total: number;
};

export type AdminCustomerListItemDto = {
  id: string;
  email: string;
  name: string;
  document: string | null;
  created_at: string;
  updated_at: string;
  licenses_count: number;
  last_subscription_status: string | null;
};

export type AdminCustomersListResponseDto = {
  success: true;
  items: AdminCustomerListItemDto[];
  page: number;
  page_size: number;
  total: number;
};

export type AdminCustomerDetailsResponseDto = {
  success: true;
  customer: {
    id: string;
    email: string;
    name: string;
    document: string | null;
    created_at: string;
    updated_at: string;
  };
  licenses: Array<{
    license: {
      id: string;
      license_key: string;
      status: string;
      max_offline_hours: number;
      transfer_count: number;
      created_at: string;
      updated_at: string;
    };
    subscription: {
      id: string;
      status: string;
      start_at: string;
      end_at: string;
      auto_renew: boolean;
    };
    plan: {
      id: string;
      code: string;
      name: string;
      max_devices: number;
      max_offline_hours: number;
      features: string[];
    };
    programs: AdminProgramDto[];
    devices: Array<{
      id: string;
      is_active: boolean;
      fingerprint_hash: string;
      match_source: string;
      last_seen_at: string | null;
      created_at: string;
    }>;
  }>;
};

export type AdminCreateCustomerResponseDto = {
  success: true;
  customer: {
    id: string;
    email: string;
    name: string;
    document: string | null;
    created_at: string;
    updated_at: string;
  };
  end_user: {
    id: string;
    customer_id: string;
    identifier: string;
    status: 'active' | 'blocked';
    created_at: string;
    updated_at: string;
  };
};

export type AdminOnboardCustomerResponseDto = {
  success: true;
  customer: {
    id: string;
    email: string;
    name: string;
    document: string | null;
    created_at: string;
    updated_at: string;
  };
  end_user: {
    id: string;
    customer_id: string;
    identifier: string;
    status: 'active' | 'blocked';
    created_at: string;
    updated_at: string;
  };
  subscription: {
    id: string;
    status: string;
    start_at: string;
    end_at: string;
    auto_renew: boolean;
  };
  plan: {
    id: string;
    code: string;
    name: string;
    max_devices: number;
    max_offline_hours: number;
    features: string[];
  };
  program: {
    id: string;
    code: string;
    name: string;
    status: string;
  };
  license: {
    id: string;
    license_key: string;
    status: string;
    max_offline_hours: number;
    transfer_count: number;
    created_at: string;
    updated_at: string;
  };
};

export type AdminLicenseResponseDto = {
  success: true;
  license: {
    id: string;
    license_key: string;
    status: string;
    max_offline_hours: number;
    transfer_count: number;
    created_at: string;
    updated_at: string;
  };
  subscription: {
    id: string;
    status: string;
    start_at: string;
    end_at: string;
    auto_renew: boolean;
  };
  plan: {
    id: string;
    code: string;
    name: string;
    max_devices: number;
    max_offline_hours: number;
    features: string[];
  };
  customer: {
    id: string;
    email: string;
    name: string;
    document: string | null;
  };
  devices: Array<{
    id: string;
    is_active: boolean;
    fingerprint_hash: string;
    match_source: string;
    last_seen_at: string | null;
    created_at: string;
  }>;
};

export type AdminOperationalSummaryResponseDto = {
  generated_at: string;
  window_days: number;
  totals: {
    customers: number;
    subscriptions_active: number;
    licenses: number;
    licenses_active: number;
    devices_active: number;
  };
  recent: {
    validation_failures: number;
    security_events_critical: number;
    transfer_events: number;
    deactivate_events: number;
  };
};
