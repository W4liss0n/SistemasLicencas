import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { AppConfigService } from '../../../config/app-config.service';
import { AdminCreateUserRequestDto, AdminUpdateUserRequestDto } from '../dto/auth.dto';

@Injectable()
export class EndUserAdminService {
  constructor(
    @Inject(AppConfigService) private readonly configService: AppConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async createUser(payload: AdminCreateUserRequestDto) {
    this.ensureEnabled();
    await this.ensureCustomerExists(payload.customer_id);

    try {
      const created = await this.prisma.endUser.create({
        data: {
          customerId: payload.customer_id,
          identifier: payload.identifier.trim().toLowerCase(),
          passwordHash: 'oidc_disabled',
          passwordSalt: 'oidc_disabled',
          hashVersion: 'oidc_v1',
          status: 'active'
        }
      });

      return {
        success: true as const,
        user: this.toResponse(created)
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DomainHttpError({
          status: HttpStatus.CONFLICT,
          code: 'user_identifier_conflict',
          detail: 'User identifier already exists for this customer',
          title: 'User conflict'
        });
      }

      throw error;
    }
  }

  async updateUser(id: string, payload: AdminUpdateUserRequestDto) {
    this.ensureEnabled();
    const existing = await this.prisma.endUser.findUnique({ where: { id } });
    if (!existing) {
      throw new DomainHttpError({
        status: HttpStatus.NOT_FOUND,
        code: 'user_not_found',
        detail: 'End user not found',
        title: 'User not found'
      });
    }

    try {
      const updated = await this.prisma.endUser.update({
        where: { id },
        data: {
          identifier: payload.identifier?.trim().toLowerCase(),
          status: payload.status
        }
      });

      if (payload.status === 'blocked') {
        await this.revokeAllSessions(id, 'user_blocked');
      }

      return {
        success: true as const,
        user: this.toResponse(updated)
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DomainHttpError({
          status: HttpStatus.CONFLICT,
          code: 'user_identifier_conflict',
          detail: 'User identifier already exists for this customer',
          title: 'User conflict'
        });
      }

      throw error;
    }
  }

  async blockUser(id: string) {
    this.ensureEnabled();
    const updated = await this.prisma.endUser.update({
      where: { id },
      data: {
        status: 'blocked'
      }
    }).catch(() => null);

    if (!updated) {
      throw new DomainHttpError({
        status: HttpStatus.NOT_FOUND,
        code: 'user_not_found',
        detail: 'End user not found',
        title: 'User not found'
      });
    }

    await this.revokeAllSessions(id, 'user_blocked');

    return {
      success: true as const,
      user: this.toResponse(updated)
    };
  }

  async unblockUser(id: string) {
    this.ensureEnabled();
    const updated = await this.prisma.endUser.update({
      where: { id },
      data: {
        status: 'active'
      }
    }).catch(() => null);

    if (!updated) {
      throw new DomainHttpError({
        status: HttpStatus.NOT_FOUND,
        code: 'user_not_found',
        detail: 'End user not found',
        title: 'User not found'
      });
    }

    return {
      success: true as const,
      user: this.toResponse(updated)
    };
  }

  private async ensureCustomerExists(customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: {
        id: customerId
      },
      select: {
        id: true
      }
    });

    if (!customer) {
      throw new DomainHttpError({
        status: HttpStatus.NOT_FOUND,
        code: 'customer_not_found',
        detail: 'Customer not found',
        title: 'Customer not found'
      });
    }
  }

  private async revokeAllSessions(userId: string, reason: string): Promise<void> {
    await this.prisma.endUserSession.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date(),
        revokeReason: reason
      }
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    const code = (error as { code?: string })?.code;
    return code === 'P2002';
  }

  private toResponse(user: {
    id: string;
    customerId: string;
    identifier: string;
    status: 'active' | 'blocked';
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      customer_id: user.customerId,
      identifier: user.identifier,
      status: user.status,
      last_login_at: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString()
    };
  }

  private ensureEnabled(): void {
    if (!this.configService.endUserAuthEnabled) {
      throw new NotFoundException('Auth endpoint is disabled');
    }
  }
}
