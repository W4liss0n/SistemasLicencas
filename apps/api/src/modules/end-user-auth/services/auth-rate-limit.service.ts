import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { RedisService } from '../../../infra/redis/redis.service';

@Injectable()
export class AuthRateLimitService {
  private readonly memoryStore = new Map<string, { count: number; expiresAt: number }>();

  constructor(@Inject(RedisService) private readonly redisService: RedisService) {}

  async assertWithinLimit(params: {
    key: string;
    max: number;
    windowSeconds: number;
    detail: string;
  }): Promise<void> {
    const current = await this.increment(params.key, params.windowSeconds);

    if (current > params.max) {
      throw new DomainHttpError({
        status: HttpStatus.TOO_MANY_REQUESTS,
        code: 'rate_limit_exceeded',
        detail: params.detail,
        title: 'Too Many Requests'
      });
    }
  }

  private async increment(key: string, windowSeconds: number): Promise<number> {
    const redisValue = await this.incrementRedis(key, windowSeconds);
    if (redisValue !== null) {
      return redisValue;
    }

    return this.incrementMemory(key, windowSeconds);
  }

  private async incrementRedis(key: string, windowSeconds: number): Promise<number | null> {
    const client = this.redisService.client;

    try {
      if (client.status !== 'ready') {
        await client.connect();
      }

      const redisKey = `auth-rate:${key}`;
      const count = await client.incr(redisKey);
      if (count === 1) {
        await client.expire(redisKey, windowSeconds);
      }
      return count;
    } catch {
      return null;
    }
  }

  private incrementMemory(key: string, windowSeconds: number): number {
    const now = Date.now();
    const expiresAt = now + windowSeconds * 1000;
    const existing = this.memoryStore.get(key);

    if (!existing || existing.expiresAt <= now) {
      this.memoryStore.set(key, { count: 1, expiresAt });
      return 1;
    }

    existing.count += 1;
    this.memoryStore.set(key, existing);
    return existing.count;
  }
}
