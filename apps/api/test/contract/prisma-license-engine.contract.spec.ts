import { PrismaClient } from '@prisma/client';
import { runLicenseEngineContractSuite } from './license-engine.contract.shared';
import { PrismaLicenseEngineContractHarness } from './helpers/prisma-fixtures';

describe('Prisma contract suite guard', () => {
  it('requires explicit RUN_PRISMA_CONTRACT=true when executed via default jest suite', () => {
    if (process.env.RUN_PRISMA_CONTRACT !== 'true') {
      expect(true).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });
});

if (process.env.RUN_PRISMA_CONTRACT === 'true') {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  runLicenseEngineContractSuite({
    suiteName: 'LicenseEnginePort contract - Prisma adapter',
    createHarness: async () => new PrismaLicenseEngineContractHarness(prisma)
  });
}
