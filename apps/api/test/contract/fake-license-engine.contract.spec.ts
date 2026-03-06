import { randomUUID } from 'node:crypto';
import { FakeLicenseEngineAdapter } from '../../src/modules/license-runtime/adapters/fake-license-engine.adapter';
import { runLicenseEngineContractSuite, type LicenseEngineContractHarness } from './license-engine.contract.shared';

function fingerprint(seed: string): Record<string, string> {
  return {
    machine_id: `${seed}-machine`,
    disk_serial: `${seed}-disk`
  };
}

class FakeLicenseEngineContractHarness implements LicenseEngineContractHarness {
  private readonly adapter = new FakeLicenseEngineAdapter();
  private readonly programId = 'contract-program';
  private readonly runId = randomUUID();

  async dispose(): Promise<void> {
    return Promise.resolve();
  }

  async validateUnknownLicense() {
    return this.adapter.validate({
      licenseKey: `UNKNOWN-${this.runId}`,
      programId: this.programId,
      fingerprint: fingerprint(`unknown-${this.runId}`)
    });
  }

  async validateBlockedLicense() {
    return this.adapter.validate({
      licenseKey: `LIC-BLK-${this.runId}`,
      programId: this.programId,
      fingerprint: fingerprint(`blocked-${this.runId}`)
    });
  }

  async validateExpiredSubscription() {
    return this.adapter.validate({
      licenseKey: `LIC-EXP-${this.runId}`,
      programId: this.programId,
      fingerprint: fingerprint(`expired-${this.runId}`)
    });
  }

  async activateFirstDevice() {
    return this.adapter.activate({
      licenseKey: `LIC-ACT-${this.runId}`,
      programId: this.programId,
      fingerprint: fingerprint(`activate-1-${this.runId}`)
    });
  }

  async activateSecondDeviceAfterFirst() {
    const licenseKey = `LIC-ACT-MAX-${this.runId}`;
    await this.adapter.activate({
      licenseKey,
      programId: this.programId,
      fingerprint: fingerprint(`max-1-${this.runId}`)
    });

    return this.adapter.activate({
      licenseKey,
      programId: this.programId,
      fingerprint: fingerprint(`max-2-${this.runId}`)
    });
  }

  async heartbeatUnknownDevice() {
    const licenseKey = `LIC-HBT-${this.runId}`;
    await this.adapter.activate({
      licenseKey,
      programId: this.programId,
      fingerprint: fingerprint(`heartbeat-known-${this.runId}`)
    });

    return this.adapter.heartbeat({
      licenseKey,
      programId: this.programId,
      fingerprint: fingerprint(`heartbeat-unknown-${this.runId}`)
    });
  }

  async transferLimitExceeded() {
    return this.adapter.transfer({
      licenseKey: `LIC-LIM-TRN-${this.runId}`,
      programId: this.programId,
      newFingerprint: fingerprint(`transfer-limit-${this.runId}`),
      reason: 'contract-test'
    });
  }

  async deactivateUnknownDevice() {
    const licenseKey = `LIC-DEC-${this.runId}`;
    await this.adapter.activate({
      licenseKey,
      programId: this.programId,
      fingerprint: fingerprint(`deactivate-known-${this.runId}`)
    });

    return this.adapter.deactivate({
      licenseKey,
      programId: this.programId,
      fingerprint: fingerprint(`deactivate-unknown-${this.runId}`)
    });
  }
}

runLicenseEngineContractSuite({
  suiteName: 'LicenseEnginePort contract - Fake adapter',
  createHarness: async () => new FakeLicenseEngineContractHarness()
});
