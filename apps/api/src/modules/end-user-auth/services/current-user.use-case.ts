import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { AccessTokenClaims } from './auth-session.types';
import { toEntitlementResponse } from './auth-session.types';
import { EntitlementResolverService } from './entitlement-resolver.service';
import { ProgramResolverService } from './program-resolver.service';

@Injectable()
export class CurrentUserUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EntitlementResolverService)
    private readonly entitlementResolver: EntitlementResolverService,
    @Inject(ProgramResolverService)
    private readonly programResolver: ProgramResolverService
  ) {}

  async execute(programIdHeader: string, claims: AccessTokenClaims) {
    const program = await this.programResolver.resolve(programIdHeader);

    if (claims.program_id !== program.id) {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'session_revoked',
        detail: 'Access token program mismatch',
        title: 'Session revoked'
      });
    }

    const session = await this.prisma.endUserSession.findUnique({
      where: {
        id: claims.sid
      }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'session_revoked',
        detail: 'Access session is no longer valid',
        title: 'Session revoked'
      });
    }

    const user = await this.prisma.endUser.findUnique({
      where: {
        id: claims.sub
      }
    });

    if (!user || user.status !== 'active') {
      throw new DomainHttpError({
        status: HttpStatus.FORBIDDEN,
        code: 'user_blocked',
        detail: 'User is blocked',
        title: 'User blocked'
      });
    }

    const entitlement = this.entitlementResolver.ensureResolved(
      await this.entitlementResolver.resolveForProgram({
        customerId: user.customerId,
        programId: program.id
      })
    );

    return {
      success: true as const,
      user: {
        id: user.id,
        customer_id: user.customerId,
        identifier: user.identifier,
        status: user.status,
        last_login_at: user.lastLoginAt ? user.lastLoginAt.toISOString() : null
      },
      entitlement: toEntitlementResponse(entitlement)
    };
  }
}
