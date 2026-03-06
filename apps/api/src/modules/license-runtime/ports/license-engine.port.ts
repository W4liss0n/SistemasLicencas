export interface LicenseEngineBaseInput {
  licenseKey: string;
  programId: string;
  fingerprint: Record<string, string>;
  programVersion?: string;
  osInfo?: string;
  ipAddress?: string;
}

export interface ValidateLicenseInput extends LicenseEngineBaseInput {}

export interface ActivateLicenseInput extends LicenseEngineBaseInput {}

export interface HeartbeatInput extends LicenseEngineBaseInput {}

export interface TransferLicenseInput {
  licenseKey: string;
  programId: string;
  newFingerprint: Record<string, string>;
  reason?: string;
  ipAddress?: string;
}

export interface DeactivateLicenseInput {
  licenseKey: string;
  programId: string;
  fingerprint: Record<string, string>;
  ipAddress?: string;
}

export type LicenseEngineFailureCode =
  | 'invalid_request'
  | 'unauthorized_program'
  | 'license_not_found'
  | 'license_blocked'
  | 'subscription_expired'
  | 'program_not_included'
  | 'fingerprint_mismatch'
  | 'max_devices_reached'
  | 'transfer_limit_exceeded';

export interface LicenseEngineFailure {
  ok: false;
  code: LicenseEngineFailureCode;
  detail: string;
}

export interface LicenseEngineLicenseInfo {
  licenseKey: string;
  expiration: string;
  planName: string;
  maxOfflineHours: number;
  features: string[];
}

export interface LicenseEngineSecurityInfo {
  riskScore: number;
  warnings: string[];
  nextHeartbeat: number;
}

export interface ValidateLicenseSuccess {
  ok: true;
  licenseInfo: LicenseEngineLicenseInfo;
  offlineToken: string;
  security: LicenseEngineSecurityInfo;
}

export interface ActivateLicenseSuccess {
  ok: true;
  licenseInfo: LicenseEngineLicenseInfo;
  offlineToken: string;
  security: LicenseEngineSecurityInfo;
}

export interface HeartbeatSuccess {
  ok: true;
  nextHeartbeat: number;
  serverTime: number;
}

export interface TransferLicenseSuccess {
  ok: true;
  transferCountMonth: number;
  message: string;
}

export interface DeactivateLicenseSuccess {
  ok: true;
  message: string;
}

export type ValidateLicenseResult = ValidateLicenseSuccess | LicenseEngineFailure;
export type ActivateLicenseResult = ActivateLicenseSuccess | LicenseEngineFailure;
export type HeartbeatResult = HeartbeatSuccess | LicenseEngineFailure;
export type TransferLicenseResult = TransferLicenseSuccess | LicenseEngineFailure;
export type DeactivateLicenseResult = DeactivateLicenseSuccess | LicenseEngineFailure;

export const LICENSE_ENGINE_PORT = Symbol('LICENSE_ENGINE_PORT');

export interface LicenseEnginePort {
  validate(input: ValidateLicenseInput): Promise<ValidateLicenseResult>;
  activate(input: ActivateLicenseInput): Promise<ActivateLicenseResult>;
  heartbeat(input: HeartbeatInput): Promise<HeartbeatResult>;
  transfer(input: TransferLicenseInput): Promise<TransferLicenseResult>;
  deactivate(input: DeactivateLicenseInput): Promise<DeactivateLicenseResult>;
}
