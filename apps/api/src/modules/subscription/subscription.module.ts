import { Module } from '@nestjs/common';
import { SUBSCRIPTION_READ_PORT } from './ports/subscription-read.port';
import { PrismaSubscriptionReadService } from './services/prisma-subscription-read.service';

@Module({
  providers: [
    PrismaSubscriptionReadService,
    {
      provide: SUBSCRIPTION_READ_PORT,
      useExisting: PrismaSubscriptionReadService
    }
  ],
  exports: [SUBSCRIPTION_READ_PORT]
})
export class SubscriptionModule {}