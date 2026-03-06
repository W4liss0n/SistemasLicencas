import {
  type ActivateLicenseResult,
  type DeactivateLicenseResult,
  type HeartbeatResult,
  type TransferLicenseResult,
  type ValidateLicenseResult
} from '../../src/modules/license-runtime/ports/license-engine.port';

export interface LicenseEngineContractHarness {
  dispose(): Promise<void>;
  validateUnknownLicense(): Promise<ValidateLicenseResult>;
  validateBlockedLicense(): Promise<ValidateLicenseResult>;
  validateExpiredSubscription(): Promise<ValidateLicenseResult>;
  activateFirstDevice(): Promise<ActivateLicenseResult>;
  activateSecondDeviceAfterFirst(): Promise<ActivateLicenseResult>;
  heartbeatUnknownDevice(): Promise<HeartbeatResult>;
  transferLimitExceeded(): Promise<TransferLicenseResult>;
  deactivateUnknownDevice(): Promise<DeactivateLicenseResult>;
}

function expectFailure(
  result:
    | ValidateLicenseResult
    | ActivateLicenseResult
    | HeartbeatResult
    | TransferLicenseResult
    | DeactivateLicenseResult,
  expectedCode: string
): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error(`Expected failure ${expectedCode}, but got success`);
  }

  expect(result.code).toBe(expectedCode);
}

export function runLicenseEngineContractSuite(options: {
  suiteName: string;
  createHarness: () => Promise<LicenseEngineContractHarness>;
}): void {
  describe(options.suiteName, () => {
    let harness: LicenseEngineContractHarness;

    beforeEach(async () => {
      harness = await options.createHarness();
    });

    afterEach(async () => {
      await harness.dispose();
    });

    it('validate: unknown license returns license_not_found', async () => {
      const result = await harness.validateUnknownLicense();
      expectFailure(result, 'license_not_found');
    });

    it('validate: blocked license returns license_blocked', async () => {
      const result = await harness.validateBlockedLicense();
      expectFailure(result, 'license_blocked');
    });

    it('validate: expired subscription returns subscription_expired', async () => {
      const result = await harness.validateExpiredSubscription();
      expectFailure(result, 'subscription_expired');
    });

    it('activate: first activation succeeds', async () => {
      const result = await harness.activateFirstDevice();
      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`Expected success, got ${result.code}`);
      }

      expect(result.licenseInfo.licenseKey).toBeDefined();
      expect(result.licenseInfo.expiration).toBeDefined();
      expect(result.offlineToken).toBeDefined();
    });

    it('activate: second device after first returns max_devices_reached', async () => {
      const result = await harness.activateSecondDeviceAfterFirst();
      expectFailure(result, 'max_devices_reached');
    });

    it('heartbeat: unknown fingerprint returns fingerprint_mismatch', async () => {
      const result = await harness.heartbeatUnknownDevice();
      expectFailure(result, 'fingerprint_mismatch');
    });

    it('transfer: monthly limit reached returns transfer_limit_exceeded', async () => {
      const result = await harness.transferLimitExceeded();
      expectFailure(result, 'transfer_limit_exceeded');
    });

    it('deactivate: unknown fingerprint returns fingerprint_mismatch', async () => {
      const result = await harness.deactivateUnknownDevice();
      expectFailure(result, 'fingerprint_mismatch');
    });
  });
}
