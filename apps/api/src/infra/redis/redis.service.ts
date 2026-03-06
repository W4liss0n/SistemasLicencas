import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(@Inject(AppConfigService) configService: AppConfigService) {
    this.client = new Redis(configService.redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 200,
      retryStrategy: () => null
    });
  }

  async ping(): Promise<'PONG' | 'DISCONNECTED'> {
    if (this.client.status !== 'ready') {
      try {
        await this.client.connect();
      } catch {
        return 'DISCONNECTED';
      }
    }

    try {
      return await this.client.ping();
    } catch {
      return 'DISCONNECTED';
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status === 'ready') {
      await this.client.quit();
      return;
    }

    this.client.disconnect();
  }
}
