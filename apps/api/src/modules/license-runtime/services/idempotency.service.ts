import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AppConfigService } from '../../../config/app-config.service';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { MetricsService } from '../../../observability/metrics.service';

type ExecuteResult<T> = {
  statusCode: number;
  body: T;
};

type ExecuteParams<T> = {
  idempotencyKey: string;
  endpoint: string;
  payload: unknown;
  execute: () => Promise<ExecuteResult<T>>;
};

type IdempotencyExecutionResult<T> = ExecuteResult<T> & {
  replayed: boolean;
};

type InMemoryRecord = {
  requestHash: string;
  responseBody?: unknown;
  statusCode?: number;
  expiresAt: Date;
};

@Injectable()
export class IdempotencyService {
  private readonly memoryStore = new Map<string, InMemoryRecord>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfigService) private readonly configService: AppConfigService,
    @Optional() @Inject(MetricsService) private readonly metricsService?: MetricsService
  ) {}

  async execute<T>(params: ExecuteParams<T>): Promise<IdempotencyExecutionResult<T>> {
    const requestHash = this.hashPayload(params.payload);
    return this.configService.nodeEnv === 'test'
      ? this.executeInMemory(params, requestHash)
      : this.executeWithPrisma(params, requestHash);
  }

  private async executeInMemory<T>(
    params: ExecuteParams<T>,
    requestHash: string
  ): Promise<IdempotencyExecutionResult<T>> {
    const cacheKey = this.toCacheKey(params.idempotencyKey, params.endpoint);
    const now = new Date();
    const existing = this.memoryStore.get(cacheKey);

    if (existing && existing.expiresAt <= now) {
      this.memoryStore.delete(cacheKey);
    }

    const refreshed = this.memoryStore.get(cacheKey);
    if (refreshed) {
      if (refreshed.requestHash !== requestHash) {
        this.throwConflict('Idempotency key already used with a different payload');
      }

      if (typeof refreshed.statusCode === 'number') {
        this.metricsService?.incrementIdempotencyReplay(params.endpoint);
        return {
          statusCode: refreshed.statusCode,
          body: refreshed.responseBody as T,
          replayed: true
        };
      }

      this.throwConflict('Idempotency key request is already in progress');
    }

    this.memoryStore.set(cacheKey, {
      requestHash,
      expiresAt: this.computeExpiry(now)
    });

    try {
      const result = await params.execute();
      const normalizedBody = this.normalizeBody(result.body);
      this.memoryStore.set(cacheKey, {
        requestHash,
        responseBody: normalizedBody,
        statusCode: result.statusCode,
        expiresAt: this.computeExpiry(now)
      });

      return {
        statusCode: result.statusCode,
        body: normalizedBody as T,
        replayed: false
      };
    } catch (error) {
      this.memoryStore.delete(cacheKey);
      throw error;
    }
  }

  private async executeWithPrisma<T>(
    params: ExecuteParams<T>,
    requestHash: string
  ): Promise<IdempotencyExecutionResult<T>> {
    const now = new Date();
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: {
        idempotencyKey_endpoint: {
          idempotencyKey: params.idempotencyKey,
          endpoint: params.endpoint
        }
      }
    });

    if (existing && existing.expiresAt <= now) {
      await this.prisma.idempotencyKey.delete({
        where: {
          id: existing.id
        }
      });
    }

    const active = existing && existing.expiresAt > now ? existing : null;
    if (active) {
      return this.resolveExistingRecord<T>(active, requestHash, params.endpoint);
    }

    const expiresAt = this.computeExpiry(now);
    let createdId: string | null = null;

    try {
      const created = await this.prisma.idempotencyKey.create({
        data: {
          idempotencyKey: params.idempotencyKey,
          endpoint: params.endpoint,
          requestHash,
          expiresAt
        }
      });
      createdId = created.id;
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code !== 'P2002') {
        throw error;
      }

      const raced = await this.prisma.idempotencyKey.findUnique({
        where: {
          idempotencyKey_endpoint: {
            idempotencyKey: params.idempotencyKey,
            endpoint: params.endpoint
          }
        }
      });

      if (!raced) {
        this.throwConflict('Idempotency conflict detected');
      }

      return this.resolveExistingRecord<T>(raced, requestHash, params.endpoint);
    }

    try {
      const result = await params.execute();
      const normalizedBody = this.normalizeBody(result.body);

      await this.prisma.idempotencyKey.update({
        where: { id: createdId },
        data: {
          statusCode: result.statusCode,
          responseBody: normalizedBody as Prisma.InputJsonValue
        }
      });

      return {
        statusCode: result.statusCode,
        body: normalizedBody as T,
        replayed: false
      };
    } catch (error) {
      if (createdId) {
        await this.prisma.idempotencyKey
          .delete({
            where: { id: createdId }
          })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  private resolveExistingRecord<T>(
    existing: {
      requestHash: string;
      responseBody: Prisma.JsonValue | null;
      statusCode: number | null;
    },
    requestHash: string,
    endpoint?: string
  ): IdempotencyExecutionResult<T> {
    if (existing.requestHash !== requestHash) {
      this.throwConflict('Idempotency key already used with a different payload');
    }

    if (existing.responseBody !== null && typeof existing.statusCode === 'number') {
      if (endpoint) {
        this.metricsService?.incrementIdempotencyReplay(endpoint);
      }
      return {
        statusCode: existing.statusCode,
        body: existing.responseBody as T,
        replayed: true
      };
    }

    this.throwConflict('Idempotency key request is already in progress');
  }

  private toCacheKey(idempotencyKey: string, endpoint: string): string {
    return `${endpoint}::${idempotencyKey}`;
  }

  private computeExpiry(now: Date): Date {
    return new Date(now.getTime() + this.configService.idempotencyTtlHours * 60 * 60 * 1000);
  }

  private hashPayload(payload: unknown): string {
    const canonical = this.stableStringify(payload);
    return createHash('sha256').update(canonical).digest('hex');
  }

  private stableStringify(input: unknown): string {
    if (input === null || typeof input !== 'object') {
      return JSON.stringify(input);
    }

    if (Array.isArray(input)) {
      return `[${input.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    const serialized = entries.map(
      ([key, value]) => `${JSON.stringify(key)}:${this.stableStringify(value)}`
    );
    return `{${serialized.join(',')}}`;
  }

  private normalizeBody<T>(body: T): T {
    return JSON.parse(JSON.stringify(body)) as T;
  }

  private throwConflict(detail: string): never {
    throw new DomainHttpError({
      code: 'idempotency_key_conflict',
      detail,
      status: HttpStatus.CONFLICT,
      title: 'Idempotency key conflict'
    });
  }
}
