import { Module } from '@nestjs/common';
import { CATALOG_BILLING_POLICY_PORT } from './ports/catalog-billing-policy.port';
import { PrismaCatalogBillingPolicyService } from './services/prisma-catalog-billing-policy.service';

@Module({
  providers: [
    PrismaCatalogBillingPolicyService,
    {
      provide: CATALOG_BILLING_POLICY_PORT,
      useExisting: PrismaCatalogBillingPolicyService
    }
  ],
  exports: [CATALOG_BILLING_POLICY_PORT]
})
export class CatalogBillingModule {}