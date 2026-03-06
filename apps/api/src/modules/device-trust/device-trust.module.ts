import { Module } from '@nestjs/common';
import { DEVICE_TRUST_PORT } from './ports/device-trust.port';
import { PrismaDeviceTrustService } from './services/prisma-device-trust.service';

@Module({
  providers: [
    PrismaDeviceTrustService,
    {
      provide: DEVICE_TRUST_PORT,
      useExisting: PrismaDeviceTrustService
    }
  ],
  exports: [DEVICE_TRUST_PORT]
})
export class DeviceTrustModule {}
