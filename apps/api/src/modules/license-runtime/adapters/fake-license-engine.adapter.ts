import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ActivateLicenseInput,
  ActivateLicenseResult,
  DeactivateLicenseInput,
  DeactivateLicenseResult,
  HeartbeatInput,
  HeartbeatResult,
  LicenseEngineFailure,
  LicenseEngineLicenseInfo,
  LicenseEnginePort,
  TransferLicenseInput,
  TransferLicenseResult,
  ValidateLicenseInput,
  ValidateLicenseResult
} from '../ports/license-engine.port';

interface FakeLicenseState {
  status: 'active' | 'blocked' | 'expired';
  expiration: string;
  planName: string;
  maxOfflineHours: number;
  maxDevices: number;
  transferCountMonth: number;
  transferMonthKey: string;
  devices: Set<string>;
}

@Injectable()
export class FakeLicenseEngineAdapter implements LicenseEnginePort {
  private readonly state = new Map<string, FakeLicenseState>();

  async validate(input: ValidateLicenseInput): Promise<ValidateLicenseResult> {
    if (input.licenseKey.includes('ERR-500')) {
      throw new Error('Synthetic fake adapter failure');
    }

    const programValidation = this.validateProgram(input.programId);
    if (programValidation) {
      return programValidation;
    }

    const licenseState = this.getLicenseState(input.licenseKey);
    if (!licenseState) {
      return this.failure('license_not_found', 'License key not found');
    }

    if (licenseState.status === 'blocked') {
      return this.failure('license_blocked', 'License is blocked');
    }

    if (licenseState.status === 'expired') {
      return this.failure('subscription_expired', 'Subscription has expired');
    }

    const fingerprintHash = this.hashFingerprint(input.fingerprint);
    if (!fingerprintHash) {
      return this.failure('invalid_request', 'Fingerprint payload is required');
    }

    if (licenseState.devices.size === 0) {
      licenseState.devices.add(fingerprintHash);
    }

    if (!licenseState.devices.has(fingerprintHash)) {
      return this.failure('fingerprint_mismatch', 'Device fingerprint mismatch');
    }

    return {
      ok: true,
      licenseInfo: this.buildLicenseInfo(input.licenseKey, licenseState),
      offlineToken: this.buildOfflineToken(input.licenseKey, fingerprintHash),
      security: {
        riskScore: 0.1,
        warnings: [],
        nextHeartbeat: 3600
      }
    };
  }

  async activate(input: ActivateLicenseInput): Promise<ActivateLicenseResult> {
    const programValidation = this.validateProgram(input.programId);
    if (programValidation) {
      return programValidation;
    }

    const licenseState = this.getLicenseState(input.licenseKey);
    if (!licenseState) {
      return this.failure('license_not_found', 'License key not found');
    }

    if (licenseState.status === 'blocked') {
      return this.failure('license_blocked', 'License is blocked');
    }

    if (licenseState.status === 'expired') {
      return this.failure('subscription_expired', 'Subscription has expired');
    }

    const fingerprintHash = this.hashFingerprint(input.fingerprint);
    if (!fingerprintHash) {
      return this.failure('invalid_request', 'Fingerprint payload is required');
    }

    if (!licenseState.devices.has(fingerprintHash) && licenseState.devices.size >= licenseState.maxDevices) {
      return this.failure(
        'max_devices_reached',
        `Maximum number of active devices reached (${licenseState.maxDevices})`
      );
    }

    licenseState.devices.add(fingerprintHash);

    return {
      ok: true,
      licenseInfo: this.buildLicenseInfo(input.licenseKey, licenseState),
      offlineToken: this.buildOfflineToken(input.licenseKey, fingerprintHash),
      security: {
        riskScore: 0.1,
        warnings: [],
        nextHeartbeat: 3600
      }
    };
  }

  async heartbeat(input: HeartbeatInput): Promise<HeartbeatResult> {
    const programValidation = this.validateProgram(input.programId);
    if (programValidation) {
      return programValidation;
    }

    const licenseState = this.getLicenseState(input.licenseKey);
    if (!licenseState) {
      return this.failure('license_not_found', 'License key not found');
    }

    if (licenseState.status === 'blocked') {
      return this.failure('license_blocked', 'License is blocked');
    }

    if (licenseState.status === 'expired') {
      return this.failure('subscription_expired', 'Subscription has expired');
    }

    const fingerprintHash = this.hashFingerprint(input.fingerprint);
    if (!fingerprintHash) {
      return this.failure('invalid_request', 'Fingerprint payload is required');
    }

    if (!licenseState.devices.has(fingerprintHash)) {
      return this.failure('fingerprint_mismatch', 'Device fingerprint mismatch');
    }

    return {
      ok: true,
      nextHeartbeat: 3600,
      serverTime: Date.now()
    };
  }

  async transfer(input: TransferLicenseInput): Promise<TransferLicenseResult> {
    const programValidation = this.validateProgram(input.programId);
    if (programValidation) {
      return programValidation;
    }

    const licenseState = this.getLicenseState(input.licenseKey);
    if (!licenseState) {
      return this.failure('license_not_found', 'License key not found');
    }

    if (licenseState.status === 'blocked') {
      return this.failure('license_blocked', 'License is blocked');
    }

    if (licenseState.status === 'expired') {
      return this.failure('subscription_expired', 'Subscription has expired');
    }

    const fingerprintHash = this.hashFingerprint(input.newFingerprint);
    if (!fingerprintHash) {
      return this.failure('invalid_request', 'New fingerprint payload is required');
    }

    const currentMonth = this.monthKey();
    if (licenseState.transferMonthKey !== currentMonth) {
      licenseState.transferMonthKey = currentMonth;
      licenseState.transferCountMonth = 0;
    }

    if (licenseState.transferCountMonth >= 3) {
      return this.failure('transfer_limit_exceeded', 'Monthly transfer limit reached (3/month)');
    }

    licenseState.devices.clear();
    licenseState.devices.add(fingerprintHash);
    licenseState.transferCountMonth += 1;

    return {
      ok: true,
      transferCountMonth: licenseState.transferCountMonth,
      message: 'License transferred successfully'
    };
  }

  async deactivate(input: DeactivateLicenseInput): Promise<DeactivateLicenseResult> {
    const programValidation = this.validateProgram(input.programId);
    if (programValidation) {
      return programValidation;
    }

    const licenseState = this.getLicenseState(input.licenseKey);
    if (!licenseState) {
      return this.failure('license_not_found', 'License key not found');
    }

    const fingerprintHash = this.hashFingerprint(input.fingerprint);
    if (!fingerprintHash) {
      return this.failure('invalid_request', 'Fingerprint payload is required');
    }

    if (!licenseState.devices.has(fingerprintHash)) {
      return this.failure('fingerprint_mismatch', 'Device fingerprint mismatch');
    }

    licenseState.devices.delete(fingerprintHash);

    return {
      ok: true,
      message: 'Device deactivated successfully'
    };
  }

  private validateProgram(programId: string): LicenseEngineFailure | null {
    if (!programId || programId.trim().length === 0) {
      return this.failure('unauthorized_program', 'Program header is required');
    }

    return null;
  }

  private getLicenseState(licenseKey: string): FakeLicenseState | null {
    if (!licenseKey.startsWith('LIC-')) {
      return null;
    }

    let current = this.state.get(licenseKey);
    if (!current) {
      const blocked = licenseKey.includes('BLK');
      const expired = licenseKey.includes('EXP');
      current = {
        status: blocked ? 'blocked' : expired ? 'expired' : 'active',
        expiration: expired ? '2024-01-01T00:00:00.000Z' : '2027-12-31T23:59:59.000Z',
        planName: 'Professional',
        maxOfflineHours: 168,
        maxDevices: 1,
        transferCountMonth: licenseKey.includes('LIM-TRN') ? 3 : 0,
        transferMonthKey: this.monthKey(),
        devices: new Set<string>()
      };
      this.state.set(licenseKey, current);
    }

    return current;
  }

  private hashFingerprint(raw: Record<string, string>): string | null {
    const entries = Object.entries(raw ?? {})
      .map(([key, value]) => [key.trim().toLowerCase(), String(value).trim()] as const)
      .filter(([key, value]) => key.length > 0 && value.length > 0)
      .sort(([a], [b]) => a.localeCompare(b));

    if (entries.length === 0) {
      return null;
    }

    const canonical = entries.map(([key, value]) => `${key}:${value}`).join('|');
    return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
  }

  private buildLicenseInfo(licenseKey: string, licenseState: FakeLicenseState): LicenseEngineLicenseInfo {
    return {
      licenseKey,
      expiration: licenseState.expiration,
      planName: licenseState.planName,
      maxOfflineHours: licenseState.maxOfflineHours,
      features: ['reports', 'multi_device']
    };
  }

  private buildOfflineToken(licenseKey: string, fingerprintHash: string): string {
    const shortHash = fingerprintHash.slice('sha256:'.length, 'sha256:'.length + 16);
    return `fake.${licenseKey}.${shortHash}`;
  }

  private monthKey(date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }

  private failure(code: LicenseEngineFailure['code'], detail: string): LicenseEngineFailure {
    return { ok: false, code, detail };
  }
}
