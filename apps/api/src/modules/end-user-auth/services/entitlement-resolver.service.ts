import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { DomainHttpError } from '../../../common/errors/domain-http-error';

export interface ResolvedEntitlement {
  customerId: string;
  subscriptionId: string;
  planCode: string;
  planName: string;
  programId: string;
  programCode: string;
  features: string[];
}

@Injectable()
export class EntitlementResolverService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveForProgram(params: {
    customerId: string;
    programId: string;
  }): Promise<ResolvedEntitlement | null> {
    const now = new Date();

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        customerId: params.customerId,
        status: 'active',
        endAt: {
          gt: now
        },
        plan: {
          planPrograms: {
            some: {
              programId: params.programId
            }
          }
        }
      },
      orderBy: {
        endAt: 'desc'
      },
      include: {
        plan: {
          include: {
            planPrograms: {
              where: {
                programId: params.programId
              },
              include: {
                program: {
                  select: {
                    id: true,
                    code: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!subscription || subscription.plan.planPrograms.length === 0) {
      return null;
    }

    const planProgram = subscription.plan.planPrograms[0];
    const features = Array.isArray(subscription.plan.features)
      ? subscription.plan.features.filter((value): value is string => typeof value === 'string')
      : [];

    return {
      customerId: params.customerId,
      subscriptionId: subscription.id,
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      programId: planProgram.program.id,
      programCode: planProgram.program.code,
      features
    };
  }

  ensureResolved(entitlement: ResolvedEntitlement | null): ResolvedEntitlement {
    if (!entitlement) {
      throw new DomainHttpError({
        status: HttpStatus.FORBIDDEN,
        code: 'entitlement_denied',
        detail: 'User customer does not have an active entitlement for this program',
        title: 'Entitlement denied'
      });
    }

    return entitlement;
  }
}
