import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { AppConfigService } from '../../../config/app-config.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  AuthenticateProgramClientInput,
  AuthenticateProgramClientResult,
  IdentityAccessFailure,
  IdentityAccessPort
} from '../ports/identity-access.port';
import { IdentityPasswordHasherService } from './identity-password-hasher.service';

@Injectable()
export class PrismaIdentityAccessService implements IdentityAccessPort {
  constructor(
    @Inject(AppConfigService) private readonly configService: AppConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdentityPasswordHasherService)
    private readonly passwordHasherService: IdentityPasswordHasherService
  ) {}

  async authenticateProgramClient(
    input: AuthenticateProgramClientInput
  ): Promise<AuthenticateProgramClientResult> {
    const programResult = await this.resolveAuthorizedProgram(input.programId);
    if (!programResult.ok) {
      return programResult;
    }

    const identifier = input.identifier.trim().toLowerCase();
    const credential = await this.prisma.clientCredential.findFirst({
      where: {
        programId: programResult.programId,
        identifier,
        isActive: true
      }
    });

    const validPassword =
      credential &&
      (await this.passwordHasherService.verifyPassword({
        password: input.password,
        storedHash: credential.passwordHash,
        storedSalt: credential.passwordSalt,
        hashVersion: credential.hashVersion
      }));

    if (!credential || !validPassword) {
      return this.failure('invalid_credentials', 'Invalid credentials');
    }

    await this.prisma.clientCredential.update({
      where: { id: credential.id },
      data: { lastAuthenticatedAt: new Date() }
    });

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 4 * 60 * 60 * 1000);
    const nonce = randomBytes(12).toString('hex');
    const accessToken = createHmac('sha256', this.configService.jwtSecret)
      .update(`${programResult.programId}:${identifier}:${issuedAt.toISOString()}:${nonce}`)
      .digest('hex');

    return {
      ok: true,
      accessToken,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
  }

  private async resolveAuthorizedProgram(
    programId: string
  ): Promise<{ ok: true; programId: string } | IdentityAccessFailure> {
    const program = await this.prisma.program.findFirst({
      where: this.isUuid(programId)
        ? { id: programId, status: 'active' }
        : { code: programId, status: 'active' },
      select: { id: true }
    });

    if (!program) {
      return this.failure('unauthorized_program', 'Program is not authorized');
    }

    return {
      ok: true,
      programId: program.id
    };
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }

  private failure(code: IdentityAccessFailure['code'], detail: string): IdentityAccessFailure {
    return { ok: false, code, detail };
  }
}
