import { Module } from '@nestjs/common';
import { OFFLINE_ENTITLEMENT_PORT } from './ports/offline-entitlement.port';
import { HmacOfflineEntitlementService } from './services/hmac-offline-entitlement.service';

@Module({
  providers: [
    HmacOfflineEntitlementService,
    {
      provide: OFFLINE_ENTITLEMENT_PORT,
      useExisting: HmacOfflineEntitlementService
    }
  ],
  exports: [OFFLINE_ENTITLEMENT_PORT]
})
export class OfflineEntitlementModule {}
