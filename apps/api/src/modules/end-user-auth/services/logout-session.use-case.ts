import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuthAuditWriterService } from './auth-audit-writer.service';
import { ProgramResolverService } from './program-resolver.service';
import { SessionTokenService } from './session-token.service';

@Injectable()
export class LogoutSessionUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProgramResolverService)
    private readonly programResolver: ProgramResolverService,
    @Inject(SessionTokenService)
    private readonly sessionTokenService: SessionTokenService,
    @Inject(AuthAuditWriterService)
    private readonly authAuditWriter: AuthAuditWriterService
  ) {}

  async execute(programIdHeader: string, refreshToken: string, ipAddress?: string) {
    const program = await this.programResolver.resolve(programIdHeader);

    const claims = await this.sessionTokenService.verifyRefreshToken(refreshToken);
    if (claims.program_id !== program.id) {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'session_revoked',
        detail: 'Refresh token program mismatch',
        title: 'Session revoked'
      });
    }

    const session = await this.prisma.endUserSession.findUnique({
      where: { id: claims.sid }
    });

    if (session && !session.revokedAt) {
      await this.prisma.endUserSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          revokeReason: 'logout'
        }
      });

      await this.authAuditWriter.write({
        userId: session.userId,
        programId: session.programId,
        eventType: 'logout',
        ipAddress,
        metadata: {
          session_id: session.id
        }
      });
    }

    return {
      success: true as const
    };
  }
}
