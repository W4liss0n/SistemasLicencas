import type { AppConfigService } from '../../../config/app-config.service';
import { HmacOfflineEntitlementService } from './hmac-offline-entitlement.service';

describe('HmacOfflineEntitlementService', () => {
  const appConfig = {
    jwtSecret: 'offline-secret'
  } as AppConfigService;

  const service = new HmacOfflineEntitlementService(appConfig);

  it('generates deterministic token for fixed input and issuedAt', () => {
    const input = {
      licenseKey: 'LIC-0001',
      fingerprintHash: 'sha256:abc',
      issuedAt: new Date('2026-03-04T12:00:00.000Z')
    };

    const first = service.issueOfflineToken(input);
    const second = service.issueOfflineToken(input);

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it('generates different token when fingerprint changes', () => {
    const issuedAt = new Date('2026-03-04T12:00:00.000Z');
    const tokenA = service.issueOfflineToken({
      licenseKey: 'LIC-0001',
      fingerprintHash: 'sha256:abc',
      issuedAt
    });
    const tokenB = service.issueOfflineToken({
      licenseKey: 'LIC-0001',
      fingerprintHash: 'sha256:def',
      issuedAt
    });

    expect(tokenA).not.toBe(tokenB);
  });
});
