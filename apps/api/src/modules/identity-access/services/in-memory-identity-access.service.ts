import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomBytes, scryptSync } from 'node:crypto';
import { AppConfigService } from '../../../config/app-config.service';
import {
  AuthenticateProgramClientInput,
  AuthenticateProgramClientResult,
  IdentityAccessFailure,
  IdentityAccessPort
} from '../ports/identity-access.port';
import { PASSWORD_HASH_VERSION } from './identity-password-hasher.service';

type MemoryCredential = {
  id: string;
  programId: string;
  identifier: string;
  passwordHash: string;
  passwordSalt: string;
  hashVersion: string;
  isActive: boolean;
  lastAuthenticatedAt?: Date;
};

@Injectable()
export class InMemoryIdentityAccessService implements IdentityAccessPort {
  private readonly credentials = new Map<string, MemoryCredential>();

  constructor(
    @Inject(AppConfigService) private readonly configService: AppConfigService
  ) {
    const seeded = this.buildSeededCredential({
      id: 'test-credential-demo',
      programId: 'demo-program',
      identifier: 'demo@example.com',
      password: 'demo123'
    });

    this.credentials.set(this.toKey(seeded.programId, seeded.identifier), seeded);
  }

  async authenticateProgramClient(
    input: AuthenticateProgramClientInput
  ): Promise<AuthenticateProgramClientResult> {
    const programId = input.programId.trim();
    if (!programId) {
      return this.failure('unauthorized_program', 'Program is not authorized');
    }

    const identifier = input.identifier.trim().toLowerCase();
    const key = this.toKey(programId, identifier);
    const credential = this.credentials.get(key);

    if (!credential || !credential.isActive) {
      return this.failure('invalid_credentials', 'Invalid credentials');
    }

    const expectedHash = scryptSync(
      `${input.password}:${this.configService.authPasswordPepper}`,
      credential.passwordSalt,
      64
    ).toString('base64');

    if (expectedHash !== credential.passwordHash) {
      return this.failure('invalid_credentials', 'Invalid credentials');
    }

    credential.lastAuthenticatedAt = new Date();

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 4 * 60 * 60 * 1000);
    const nonce = randomBytes(12).toString('hex');
    const accessToken = createHmac('sha256', this.configService.jwtSecret)
      .update(`${programId}:${identifier}:${issuedAt.toISOString()}:${nonce}`)
      .digest('hex');

    return {
      ok: true,
      accessToken,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
  }

  private buildSeededCredential(params: {
    id: string;
    programId: string;
    identifier: string;
    password: string;
  }): MemoryCredential {
    const salt = 'in-memory-demo-credential-salt';
    const hash = scryptSync(
      `${params.password}:${this.configService.authPasswordPepper}`,
      salt,
      64
    ).toString('base64');

    return {
      id: params.id,
      programId: params.programId,
      identifier: params.identifier.toLowerCase(),
      passwordHash: hash,
      passwordSalt: salt,
      hashVersion: PASSWORD_HASH_VERSION,
      isActive: true
    };
  }

  private toKey(programId: string, identifier: string): string {
    return `${programId.toLowerCase()}::${identifier.trim().toLowerCase()}`;
  }

  private failure(code: IdentityAccessFailure['code'], detail: string): IdentityAccessFailure {
    return { ok: false, code, detail };
  }
}
