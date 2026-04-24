import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';

@Injectable()
export class AuthAuditWriterService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async write(params: {
    userId: string;
    programId: string;
    eventType: string;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.authAuditEvent.create({
      data: {
        userId: params.userId,
        programId: params.programId,
        eventType: params.eventType,
        metadata: ({ ...(params.metadata ?? {}), ip: params.ipAddress ?? null }) as Prisma.InputJsonValue
      }
    });
  }
}
