import type { PrismaService } from '../../../infra/prisma/prisma.service';
import { PrismaCatalogBillingPolicyService } from './prisma-catalog-billing-policy.service';

describe('PrismaCatalogBillingPolicyService', () => {
  const programFindFirst = jest.fn();
  const planFindUnique = jest.fn();
  const prisma = {
    program: {
      findFirst: programFindFirst
    },
    plan: {
      findUnique: planFindUnique
    }
  } as unknown as PrismaService;

  const service = new PrismaCatalogBillingPolicyService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns unauthorized_program when program is missing', async () => {
    programFindFirst.mockResolvedValue(null);

    const result = await service.resolveAuthorizedProgram('demo-program');

    expect(result).toEqual({
      ok: false,
      code: 'unauthorized_program',
      detail: 'Program is not authorized'
    });
  });

  it('returns authorized program context', async () => {
    programFindFirst.mockResolvedValue({
      id: 'program-1',
      code: 'demo-program'
    });

    const result = await service.resolveAuthorizedProgram('demo-program');

    expect(result).toEqual({
      ok: true,
      program: {
        id: 'program-1',
        code: 'demo-program'
      }
    });
  });

  it('returns program_not_included when plan is absent or not linked', async () => {
    planFindUnique.mockResolvedValue({
      id: 'plan-1',
      name: 'Professional',
      maxDevices: 2,
      features: ['a', 'b'],
      planPrograms: []
    });

    const result = await service.resolveProgramPolicy({
      programId: 'program-1',
      planId: 'plan-1'
    });

    expect(result).toEqual({
      ok: false,
      code: 'program_not_included',
      detail: 'Program not included in subscription plan'
    });
  });

  it('returns normalized plan policy when plan is linked to program', async () => {
    planFindUnique.mockResolvedValue({
      id: 'plan-1',
      name: 'Professional',
      maxDevices: 3,
      features: ['module_a', 10],
      planPrograms: [{ id: 'pp-1' }]
    });

    const result = await service.resolveProgramPolicy({
      programId: 'program-1',
      planId: 'plan-1'
    });

    expect(result).toEqual({
      ok: true,
      policy: {
        planId: 'plan-1',
        planName: 'Professional',
        maxDevices: 3,
        features: ['module_a', '10']
      }
    });
  });
});