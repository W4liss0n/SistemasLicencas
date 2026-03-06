import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { AppConfigService } from '../../config/app-config.service';

type DependencyStatus = 'up' | 'down';

@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RedisService)
    private readonly redisService: RedisService,
    @Inject(AppConfigService)
    private readonly configService: AppConfigService
  ) {}

  async check(): Promise<{
    status: 'ok' | 'degraded';
    dependencies: { database: DependencyStatus; redis: DependencyStatus };
    timestamp: string;
  }> {
    const deps: { database: DependencyStatus; redis: DependencyStatus } = {
      database: 'down',
      redis: 'down'
    };

    if (this.configService.nodeEnv !== 'test') {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        deps.database = 'up';
      } catch {
        deps.database = 'down';
      }

      const redisPing = await this.redisService.ping();
      deps.redis = redisPing === 'PONG' ? 'up' : 'down';
    }

    return {
      status: deps.database === 'up' && deps.redis === 'up' ? 'ok' : 'degraded',
      dependencies: deps,
      timestamp: new Date().toISOString()
    };
  }
}