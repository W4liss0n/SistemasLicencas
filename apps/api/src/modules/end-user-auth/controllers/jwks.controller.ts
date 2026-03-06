import { Controller, Get, HttpCode, Inject } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import {
  OFFLINE_ENTITLEMENT_PORT,
  OfflineEntitlementPort,
  type OfflineSessionJwks
} from '../../offline-entitlement/ports/offline-entitlement.port';

@ApiExcludeController()
@Controller('.well-known')
export class JwksController {
  constructor(
    @Inject(OFFLINE_ENTITLEMENT_PORT)
    private readonly offlineEntitlement: OfflineEntitlementPort
  ) {}

  @Get('jwks.json')
  @HttpCode(200)
  async getJwks(): Promise<OfflineSessionJwks> {
    return this.offlineEntitlement.getOfflineSessionJwks();
  }
}
