export type DeviceTrustFailureCode = 'invalid_request';

export interface DeviceTrustFailure {
  ok: false;
  code: DeviceTrustFailureCode;
  detail: string;
}

export interface ParsedDeviceFingerprint {
  fingerprintHash: string;
  rawComponents: Record<string, string>;
}

export interface ParseDeviceFingerprintSuccess {
  ok: true;
  parsed: ParsedDeviceFingerprint;
}

export type ParseDeviceFingerprintResult = ParseDeviceFingerprintSuccess | DeviceTrustFailure;

export interface RegisterDeviceInput {
  licenseId: string;
  fingerprintHash: string;
  rawComponents: Record<string, string>;
  matchSource: string;
}

export interface TouchDeviceInput {
  licenseDeviceId: string;
  matchSource: string;
}

export interface ReplaceActiveDeviceInput {
  licenseId: string;
  fingerprintHash: string;
  rawComponents: Record<string, string>;
  matchSource: string;
}

export interface DeactivateDeviceInput {
  licenseDeviceId: string;
  matchSource: string;
}

export const DEVICE_TRUST_PORT = Symbol('DEVICE_TRUST_PORT');

export interface DeviceTrustPort {
  parseFingerprint(fingerprint: Record<string, string>): ParseDeviceFingerprintResult;
  registerDevice(input: RegisterDeviceInput): Promise<void>;
  touchDevice(input: TouchDeviceInput): Promise<void>;
  replaceActiveDevice(input: ReplaceActiveDeviceInput): Promise<void>;
  deactivateDevice(input: DeactivateDeviceInput): Promise<void>;
}
