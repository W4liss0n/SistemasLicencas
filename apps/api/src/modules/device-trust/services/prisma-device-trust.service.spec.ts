import { createHash } from 'node:crypto';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import { PrismaDeviceTrustService } from './prisma-device-trust.service';

describe('PrismaDeviceTrustService', () => {
  const deviceFingerprintUpsert = jest.fn();
  const licenseDeviceCreate = jest.fn();
  const licenseDeviceUpdate = jest.fn();
  const licenseDeviceUpdateMany = jest.fn();
  const licenseDeviceFindFirst = jest.fn();

  const prisma = {
    deviceFingerprint: {
      upsert: deviceFingerprintUpsert
    },
    licenseDevice: {
      create: licenseDeviceCreate,
      update: licenseDeviceUpdate,
      updateMany: licenseDeviceUpdateMany,
      findFirst: licenseDeviceFindFirst
    }
  } as unknown as PrismaService;

  const service = new PrismaDeviceTrustService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns invalid_request when fingerprint payload is empty', () => {
    const result = service.parseFingerprint({});

    expect(result).toEqual({
      ok: false,
      code: 'invalid_request',
      detail: 'Fingerprint payload is required'
    });
  });

  it('normalizes fingerprint payload and returns deterministic hash', () => {
    const result = service.parseFingerprint({
      CPU: '  i7  ',
      motherboard: 'MB-001',
      '': 'ignored',
      gpu: '   '
    });

    const canonical = 'cpu:i7|motherboard:MB-001';
    const expectedHash = `sha256:${createHash('sha256').update(canonical).digest('hex')}`;

    expect(result).toEqual({
      ok: true,
      parsed: {
        fingerprintHash: expectedHash,
        rawComponents: {
          cpu: 'i7',
          motherboard: 'MB-001'
        }
      }
    });
  });

  it('registers device by upserting fingerprint and creating active device link', async () => {
    deviceFingerprintUpsert.mockResolvedValue({ id: 'fp-1' });

    await service.registerDevice({
      licenseId: 'lic-1',
      fingerprintHash: 'sha256:abc',
      rawComponents: { cpu: 'i7' },
      matchSource: 'activate'
    });

    expect(deviceFingerprintUpsert).toHaveBeenCalledWith({
      where: { fingerprintHash: 'sha256:abc' },
      create: {
        fingerprintHash: 'sha256:abc',
        rawComponents: { cpu: 'i7' },
        algorithm: 'stable_v2'
      },
      update: {
        rawComponents: { cpu: 'i7' },
        algorithm: 'stable_v2'
      }
    });

    expect(licenseDeviceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        licenseId: 'lic-1',
        fingerprintId: 'fp-1',
        isActive: true,
        matchSource: 'activate'
      })
    });
  });

  it('touches existing license device', async () => {
    await service.touchDevice({
      licenseDeviceId: 'device-1',
      matchSource: 'heartbeat'
    });

    expect(licenseDeviceUpdate).toHaveBeenCalledWith({
      where: { id: 'device-1' },
      data: {
        lastSeenAt: expect.any(Date),
        matchSource: 'heartbeat'
      }
    });
  });

  it('replaces active device and reactivates existing binding when fingerprint already linked', async () => {
    deviceFingerprintUpsert.mockResolvedValue({ id: 'fp-1' });
    licenseDeviceFindFirst.mockResolvedValue({ id: 'device-existing' });

    await service.replaceActiveDevice({
      licenseId: 'lic-1',
      fingerprintHash: 'sha256:abc',
      rawComponents: { cpu: 'i7' },
      matchSource: 'transfer'
    });

    expect(licenseDeviceUpdateMany).toHaveBeenCalledWith({
      where: { licenseId: 'lic-1' },
      data: { isActive: false }
    });

    expect(licenseDeviceUpdate).toHaveBeenCalledWith({
      where: { id: 'device-existing' },
      data: {
        isActive: true,
        lastSeenAt: expect.any(Date),
        matchSource: 'transfer'
      }
    });

    expect(licenseDeviceCreate).not.toHaveBeenCalled();
  });

  it('replaces active device and creates binding when fingerprint was not linked', async () => {
    deviceFingerprintUpsert.mockResolvedValue({ id: 'fp-2' });
    licenseDeviceFindFirst.mockResolvedValue(null);

    await service.replaceActiveDevice({
      licenseId: 'lic-1',
      fingerprintHash: 'sha256:def',
      rawComponents: { cpu: 'ryzen' },
      matchSource: 'transfer'
    });

    expect(licenseDeviceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        licenseId: 'lic-1',
        fingerprintId: 'fp-2',
        isActive: true,
        matchSource: 'transfer'
      })
    });
  });

  it('deactivates a device binding', async () => {
    await service.deactivateDevice({
      licenseDeviceId: 'device-1',
      matchSource: 'deactivate'
    });

    expect(licenseDeviceUpdate).toHaveBeenCalledWith({
      where: { id: 'device-1' },
      data: {
        isActive: false,
        matchSource: 'deactivate'
      }
    });
  });
});
