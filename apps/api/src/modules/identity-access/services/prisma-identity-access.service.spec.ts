import type { AppConfigService } from '../../../config/app-config.service';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { IdentityPasswordHasherService } from './identity-password-hasher.service';
import { PrismaIdentityAccessService } from './prisma-identity-access.service';

describe('PrismaIdentityAccessService', () => {
  const programFindFirst = jest.fn();
  const clientCredentialFindFirst = jest.fn();
  const clientCredentialUpdate = jest.fn();
  const verifyPassword = jest.fn();

  const appConfig = {
    jwtSecret: 'test-secret'
  } as AppConfigService;

  const prisma = {
    program: {
      findFirst: programFindFirst
    },
    clientCredential: {
      findFirst: clientCredentialFindFirst,
      update: clientCredentialUpdate
    }
  } as unknown as PrismaService;

  const passwordHasher = {
    verifyPassword
  } as unknown as IdentityPasswordHasherService;

  const service = new PrismaIdentityAccessService(appConfig, prisma, passwordHasher);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns unauthorized_program when program is not active', async () => {
    programFindFirst.mockResolvedValue(null);

    const result = await service.authenticateProgramClient({
      programId: 'unknown-program',
      identifier: 'demo@example.com',
      password: 'demo123'
    });

    expect(result).toEqual({
      ok: false,
      code: 'unauthorized_program',
      detail: 'Program is not authorized'
    });
  });

  it('returns invalid_credentials when credential is missing', async () => {
    programFindFirst.mockResolvedValue({ id: 'program-1' });
    clientCredentialFindFirst.mockResolvedValue(null);

    const result = await service.authenticateProgramClient({
      programId: 'program-1',
      identifier: 'demo@example.com',
      password: 'demo123'
    });

    expect(result).toEqual({
      ok: false,
      code: 'invalid_credentials',
      detail: 'Invalid credentials'
    });
  });

  it('returns invalid_credentials when password verification fails', async () => {
    programFindFirst.mockResolvedValue({ id: 'program-1' });
    clientCredentialFindFirst.mockResolvedValue({
      id: 'cred-1',
      passwordHash: 'hash',
      passwordSalt: 'salt',
      hashVersion: 'scrypt_v1'
    });
    verifyPassword.mockResolvedValue(false);

    const result = await service.authenticateProgramClient({
      programId: 'program-1',
      identifier: 'demo@example.com',
      password: 'wrong'
    });

    expect(result).toEqual({
      ok: false,
      code: 'invalid_credentials',
      detail: 'Invalid credentials'
    });
  });

  it('returns token payload and updates lastAuthenticatedAt when credentials are valid', async () => {
    programFindFirst.mockResolvedValue({ id: 'program-1' });
    clientCredentialFindFirst.mockResolvedValue({
      id: 'cred-1',
      passwordHash: 'hash',
      passwordSalt: 'salt',
      hashVersion: 'scrypt_v1'
    });
    verifyPassword.mockResolvedValue(true);

    const result = await service.authenticateProgramClient({
      programId: 'program-1',
      identifier: 'demo@example.com',
      password: 'demo123'
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.accessToken).toBeDefined();
      expect(result.issuedAt).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    }
    expect(clientCredentialUpdate).toHaveBeenCalledWith({
      where: { id: 'cred-1' },
      data: { lastAuthenticatedAt: expect.any(Date) }
    });
  });
});
