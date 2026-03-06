import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { InMemoryAdminBackofficeService } from './in-memory-admin-backoffice.service';

describe('InMemoryAdminBackofficeService', () => {
  let service: InMemoryAdminBackofficeService;

  beforeEach(() => {
    service = new InMemoryAdminBackofficeService();
  });

  it('provisions license successfully', async () => {
    const result = await service.provisionLicense({
      programCode: 'demo-program',
      planCode: 'basic',
      customer: {
        email: 'customer@example.com',
        name: 'Customer'
      },
      subscription: {
        endAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
      }
    });

    expect(result.license.licenseKey).toMatch(/^LIC-/);
    expect(result.license.status).toBe('active');
    expect(result.plan.code).toBe('basic');
    expect(result.subscription.status).toBe('active');
  });

  it('rejects plan that is not authorized for the program', async () => {
    await expect(
      service.provisionLicense({
        programCode: 'demo-program',
        planCode: 'enterprise',
        customer: {
          email: 'customer@example.com',
          name: 'Customer'
        },
        subscription: {
          endAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
        }
      })
    ).rejects.toThrow(DomainHttpError);

    await expect(
      service.provisionLicense({
        programCode: 'demo-program',
        planCode: 'enterprise',
        customer: {
          email: 'customer@example.com',
          name: 'Customer'
        },
        subscription: {
          endAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
        }
      })
    ).rejects.toThrow('Plan is not authorized for this program');
  });

  it('rejects renew with invalid date', async () => {
    const provisioned = await service.provisionLicense({
      programCode: 'demo-program',
      planCode: 'basic',
      customer: {
        email: 'customer@example.com',
        name: 'Customer'
      },
      subscription: {
        endAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
      }
    });

    await expect(
      service.renewLicense({
        licenseKey: provisioned.license.licenseKey,
        newEndAt: 'invalid-date'
      })
    ).rejects.toThrow('new_end_at must be a valid ISO date');
  });

  it('supports block and unblock transitions', async () => {
    const provisioned = await service.provisionLicense({
      programCode: 'demo-program',
      planCode: 'basic',
      customer: {
        email: 'customer@example.com',
        name: 'Customer'
      },
      subscription: {
        endAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
      }
    });

    const blocked = await service.blockLicense({
      licenseKey: provisioned.license.licenseKey
    });
    expect(blocked.license.status).toBe('blocked');

    const unblocked = await service.unblockLicense({
      licenseKey: provisioned.license.licenseKey
    });
    expect(unblocked.license.status).toBe('active');
  });

  it('keeps cancel operation idempotent', async () => {
    const provisioned = await service.provisionLicense({
      programCode: 'demo-program',
      planCode: 'basic',
      customer: {
        email: 'customer@example.com',
        name: 'Customer'
      },
      subscription: {
        endAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
      }
    });

    const first = await service.cancelLicense({
      licenseKey: provisioned.license.licenseKey
    });
    const second = await service.cancelLicense({
      licenseKey: provisioned.license.licenseKey
    });

    expect(first.license.status).toBe('inactive');
    expect(second.license.status).toBe('inactive');
    expect(first.subscription.status).toBe('cancelled');
    expect(second.subscription.status).toBe('cancelled');
  });

  it('creates programs with unique generated code', async () => {
    const first = await service.createProgram({
      name: 'Desktop Agent'
    });
    const second = await service.createProgram({
      name: 'Desktop Agent'
    });

    expect(first.id).not.toEqual(second.id);
    expect(first.code).not.toEqual(second.code);
    expect(first.code).toContain('desktop-agent');
  });

  it('fails to create plan without linked programs', async () => {
    await expect(
      service.createPlan({
        name: 'Starter',
        maxDevices: 1,
        maxOfflineHours: 72,
        features: ['validate'],
        programIds: []
      })
    ).rejects.toThrow('program_ids must include at least one program');
  });

  it('fails onboarding when plan does not include selected program', async () => {
    const externalProgram = await service.createProgram({
      name: 'External Program'
    });

    await expect(
      service.onboardCustomer({
        selectionMode: 'plan',
        customer: {
          email: 'not-included@example.com',
          name: 'Not Included'
        },
        programId: externalProgram.id,
        planId: '22222222-2222-4222-8222-222222222222',
        subscriptionEndAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
      })
    ).rejects.toThrow('Plan is not authorized for this program');
  });

  it('onboards customer and creates all linked aggregates', async () => {
    const program = await service.createProgram({
      name: 'Acme Launcher'
    });
    const plan = await service.createPlan({
      name: 'Acme Pro',
      maxDevices: 3,
      maxOfflineHours: 120,
      features: ['validate', 'activate'],
      programIds: [program.id]
    });

    const onboarded = await service.onboardCustomer({
      selectionMode: 'plan',
      customer: {
        email: 'onboarded@example.com',
        name: 'Onboarded User'
      },
      programId: program.id,
      planId: plan.id,
      subscriptionEndAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    });

    expect(onboarded.customer.email).toBe('onboarded@example.com');
    expect(onboarded.endUser.identifier).toBe('onboarded@example.com');
    expect(onboarded.subscription.status).toBe('active');
    expect(onboarded.plan.id).toBe(plan.id);
    expect(onboarded.program.id).toBe(program.id);
    expect(onboarded.license.licenseKey).toMatch(/^LIC-/);

    const customers = await service.listCustomers({ page: 1, pageSize: 20 });
    const customer = customers.items.find((item) => item.email === 'onboarded@example.com');
    expect(customer).toBeDefined();
    expect(customer?.licensesCount).toBe(1);
    expect(customer?.lastSubscriptionStatus).toBe('active');
  });

  it('creates customer and end user without subscription when no plan is selected', async () => {
    const created = await service.createCustomer({
      customer: {
        email: 'sem-plano@example.com',
        name: 'Cliente Sem Plano'
      }
    });

    expect(created.customer.email).toBe('sem-plano@example.com');
    expect(created.endUser.identifier).toBe('sem-plano@example.com');

    const customers = await service.listCustomers({ page: 1, pageSize: 20 });
    const customer = customers.items.find((item) => item.email === 'sem-plano@example.com');
    expect(customer?.licensesCount).toBe(0);
    expect(customer?.lastSubscriptionStatus).toBeNull();
  });

  it('onboards with individual program mode using an internal plan hidden from plan listing', async () => {
    const program = await service.createProgram({
      name: 'Solo Program'
    });

    const onboarded = await service.onboardCustomer({
      selectionMode: 'individual_program',
      customer: {
        email: 'individual@example.com',
        name: 'Individual Program User'
      },
      programId: program.id,
      subscriptionEndAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    });

    expect(onboarded.program.id).toBe(program.id);
    expect(onboarded.plan.code).toBe(`__program_individual__${program.code}`);
    expect(onboarded.plan.name).toBe(`Programa individual - ${program.name}`);

    const plans = await service.listPlans({ page: 1, pageSize: 50 });
    expect(plans.items.some((plan) => plan.id === onboarded.plan.id)).toBe(false);
  });

  it('resolves program automatically when a plan has a single linked program', async () => {
    const program = await service.createProgram({
      name: 'Single Program'
    });
    const plan = await service.createPlan({
      name: 'Single Plan',
      maxDevices: 2,
      maxOfflineHours: 72,
      features: ['validate'],
      programIds: [program.id]
    });

    const onboarded = await service.onboardCustomer({
      selectionMode: 'plan',
      customer: {
        email: 'single-plan@example.com',
        name: 'Single Plan User'
      },
      planId: plan.id,
      subscriptionEndAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
    });

    expect(onboarded.plan.id).toBe(plan.id);
    expect(onboarded.program.id).toBe(program.id);
  });
});
