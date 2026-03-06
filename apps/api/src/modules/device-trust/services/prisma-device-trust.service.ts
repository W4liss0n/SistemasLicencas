import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  DeactivateDeviceInput,
  DeviceTrustFailure,
  DeviceTrustPort,
  ParseDeviceFingerprintResult,
  RegisterDeviceInput,
  ReplaceActiveDeviceInput,
  TouchDeviceInput
} from '../ports/device-trust.port';

@Injectable()
export class PrismaDeviceTrustService implements DeviceTrustPort {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  parseFingerprint(fingerprint: Record<string, string>): ParseDeviceFingerprintResult {
    const normalized = Object.entries(fingerprint ?? {})
      .map(([key, value]) => [key.trim().toLowerCase(), String(value).trim()] as const)
      .filter(([key, value]) => key.length > 0 && value.length > 0)
      .sort(([a], [b]) => a.localeCompare(b));

    if (normalized.length === 0) {
      return this.failure('invalid_request', 'Fingerprint payload is required');
    }

    const rawComponents = Object.fromEntries(normalized);
    const canonical = normalized.map(([key, value]) => `${key}:${value}`).join('|');
    const fingerprintHash = `sha256:${createHash('sha256').update(canonical).digest('hex')}`;

    return {
      ok: true,
      parsed: {
        fingerprintHash,
        rawComponents
      }
    };
  }

  async registerDevice(input: RegisterDeviceInput): Promise<void> {
    const fingerprint = await this.getOrCreateFingerprint(input.fingerprintHash, input.rawComponents);

    await this.prisma.licenseDevice.create({
      data: {
        licenseId: input.licenseId,
        fingerprintId: fingerprint.id,
        isActive: true,
        matchSource: input.matchSource,
        lastSeenAt: new Date()
      }
    });
  }

  async touchDevice(input: TouchDeviceInput): Promise<void> {
    await this.prisma.licenseDevice.update({
      where: { id: input.licenseDeviceId },
      data: {
        lastSeenAt: new Date(),
        matchSource: input.matchSource
      }
    });
  }

  async replaceActiveDevice(input: ReplaceActiveDeviceInput): Promise<void> {
    const fingerprint = await this.getOrCreateFingerprint(input.fingerprintHash, input.rawComponents);

    await this.prisma.licenseDevice.updateMany({
      where: {
        licenseId: input.licenseId
      },
      data: {
        isActive: false
      }
    });

    const existing = await this.prisma.licenseDevice.findFirst({
      where: {
        licenseId: input.licenseId,
        fingerprintId: fingerprint.id
      }
    });

    if (existing) {
      await this.prisma.licenseDevice.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          lastSeenAt: new Date(),
          matchSource: input.matchSource
        }
      });
      return;
    }

    await this.prisma.licenseDevice.create({
      data: {
        licenseId: input.licenseId,
        fingerprintId: fingerprint.id,
        isActive: true,
        matchSource: input.matchSource,
        lastSeenAt: new Date()
      }
    });
  }

  async deactivateDevice(input: DeactivateDeviceInput): Promise<void> {
    await this.prisma.licenseDevice.update({
      where: { id: input.licenseDeviceId },
      data: {
        isActive: false,
        matchSource: input.matchSource
      }
    });
  }

  private async getOrCreateFingerprint(
    fingerprintHash: string,
    rawComponents: Record<string, string>
  ) {
    return this.prisma.deviceFingerprint.upsert({
      where: { fingerprintHash },
      create: {
        fingerprintHash,
        rawComponents,
        algorithm: 'stable_v2'
      },
      update: {
        rawComponents,
        algorithm: 'stable_v2'
      }
    });
  }

  private failure(code: DeviceTrustFailure['code'], detail: string): DeviceTrustFailure {
    return { ok: false, code, detail };
  }
}
