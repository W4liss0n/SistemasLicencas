import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../../infra/prisma/prisma.service';
import type {
  AdminCreateCustomerResult,
  AdminCustomerDetails,
  AdminCustomerSummary,
  CreateCustomerInput,
  GetCustomerDetailsInput,
  ListCustomersInput,
  PaginatedResult
} from '../../ports/admin-backoffice.port';
import { PrismaAdminBackofficeSupport } from './prisma-admin-backoffice-support';

export class PrismaAdminCustomersOperations {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: PrismaAdminBackofficeSupport
  ) {}

  async listCustomers(input: ListCustomersInput): Promise<PaginatedResult<AdminCustomerSummary>> {
    const pagination = this.support.resolvePagination(input);
    const where: Prisma.CustomerWhereInput | undefined = pagination.query
      ? {
          OR: [
            { email: { contains: pagination.query, mode: 'insensitive' } },
            { name: { contains: pagination.query, mode: 'insensitive' } },
            { document: { contains: pagination.query, mode: 'insensitive' } }
          ]
        }
      : undefined;

    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include: {
          subscriptions: {
            select: {
              status: true,
              createdAt: true,
              _count: {
                select: { licenses: true }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.pageSize
      })
    ]);

    return {
      items: customers.map((customer) => this.support.toCustomerSummary(customer)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total
    };
  }

  async getCustomerDetails(input: GetCustomerDetailsInput): Promise<AdminCustomerDetails> {
    const customerId = this.support.normalizeRequiredText(input.customerId, 'customer_id');
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        subscriptions: {
          include: {
            plan: {
              include: {
                planPrograms: {
                  include: { program: true }
                }
              }
            },
            licenses: {
              include: {
                devices: {
                  include: {
                    fingerprint: true
                  },
                  orderBy: {
                    createdAt: 'desc'
                  }
                }
              },
              orderBy: {
                createdAt: 'desc'
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!customer) {
      this.support.throwDomainError(
        HttpStatus.NOT_FOUND,
        'customer_not_found',
        'Customer not found'
      );
    }

    return {
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        document: customer.document,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString()
      },
      licenses: customer.subscriptions.flatMap((subscription) => {
        const programs = subscription.plan.planPrograms
          .map((planProgram) => this.support.toProgramSummary(planProgram.program))
          .sort((left, right) => left.name.localeCompare(right.name));
        const features = this.support.toStringArray(subscription.plan.features);

        return subscription.licenses.map((license) => ({
          license: {
            id: license.id,
            licenseKey: license.licenseKey,
            status: license.status,
            maxOfflineHours: license.maxOfflineHours,
            transferCount: license.transferCount,
            createdAt: license.createdAt.toISOString(),
            updatedAt: license.updatedAt.toISOString()
          },
          subscription: {
            id: subscription.id,
            status: subscription.status,
            startAt: subscription.startAt.toISOString(),
            endAt: subscription.endAt.toISOString(),
            autoRenew: subscription.autoRenew
          },
          plan: {
            id: subscription.plan.id,
            code: subscription.plan.code,
            name: subscription.plan.name,
            maxDevices: subscription.plan.maxDevices,
            maxOfflineHours: subscription.plan.maxOfflineHours,
            features
          },
          programs,
          devices: license.devices.map((device) => ({
            id: device.id,
            isActive: device.isActive,
            fingerprintHash: device.fingerprint.fingerprintHash,
            matchSource: device.matchSource,
            lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
            createdAt: device.createdAt.toISOString()
          }))
        }));
      })
    };
  }

  async createCustomer(input: CreateCustomerInput): Promise<AdminCreateCustomerResult> {
    const customerEmail = this.support.normalizeEmail(input.customer.email);
    const customerName = this.support.normalizeRequiredText(input.customer.name, 'customer.name');
    const customerDocument = this.support.normalizeOptionalText(input.customer.document);
    const requestedBy = this.support.normalizeOptionalText(input.requestedBy) ?? 'internal-admin';

    const result = await this.prisma.$transaction(async (tx) => {
      const { customer, endUser } = await this.support.upsertCustomerAndEndUser(tx, {
        email: customerEmail,
        name: customerName,
        document: customerDocument
      });

      await tx.auditLog.create({
        data: {
          entityType: 'customer',
          entityId: customer.id,
          action: 'admin_customer_create',
          payload: {
            requested_by: requestedBy,
            customer_id: customer.id,
            end_user_id: endUser.id
          } as Prisma.InputJsonValue
        }
      });

      return {
        customer,
        endUser
      };
    });

    return {
      customer: {
        id: result.customer.id,
        email: result.customer.email,
        name: result.customer.name,
        document: result.customer.document,
        createdAt: result.customer.createdAt.toISOString(),
        updatedAt: result.customer.updatedAt.toISOString()
      },
      endUser: {
        id: result.endUser.id,
        customerId: result.endUser.customerId,
        identifier: result.endUser.identifier,
        status: result.endUser.status,
        createdAt: result.endUser.createdAt.toISOString(),
        updatedAt: result.endUser.updatedAt.toISOString()
      }
    };
  }
}
