import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DomainHttpError } from '../../../../common/errors/domain-http-error';
import type { PrismaService } from '../../../../infra/prisma/prisma.service';
import type {
  AdminOnboardCustomerResult,
  OnboardCustomerInput
} from '../../ports/admin-backoffice.port';
import { PrismaAdminBackofficeSupport } from './prisma-admin-backoffice-support';

export class PrismaAdminOnboardingOperations {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: PrismaAdminBackofficeSupport
  ) {}

  async onboardCustomer(input: OnboardCustomerInput): Promise<AdminOnboardCustomerResult> {
    const customerEmail = this.support.normalizeEmail(input.customer.email);
    const customerName = this.support.normalizeRequiredText(input.customer.name, 'customer.name');
    const customerDocument = this.support.normalizeOptionalText(input.customer.document);
    const selectionMode = this.support.normalizeSelectionMode(input.selectionMode);
    const subscriptionStartAt = input.subscriptionStartAt
      ? this.support.parseDate(input.subscriptionStartAt, 'subscription_start_at')
      : new Date();
    const subscriptionEndAt = this.support.parseDate(input.subscriptionEndAt, 'subscription_end_at');
    const requestedBy = this.support.normalizeOptionalText(input.requestedBy) ?? 'internal-admin';

    if (subscriptionEndAt <= subscriptionStartAt) {
      this.support.throwDomainError(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'subscription_end_at must be greater than subscription_start_at'
      );
    }

    if (input.maxOfflineHours !== undefined) {
      this.support.normalizePositiveInteger(input.maxOfflineHours, 'max_offline_hours');
    }

    const result = await this.prisma
      .$transaction(async (tx) => {
        const { plan, program } = await this.support.resolveOnboardingSelection(
          tx,
          input,
          selectionMode
        );
        const { customer, endUser } = await this.support.upsertCustomerAndEndUser(tx, {
          email: customerEmail,
          name: customerName,
          document: customerDocument
        });

        const subscription = await tx.subscription.create({
          data: {
            customerId: customer.id,
            planId: plan.id,
            status: 'active',
            startAt: subscriptionStartAt,
            endAt: subscriptionEndAt,
            autoRenew: input.autoRenew ?? false,
            metadata: {
              source: 'admin_onboard',
              selection_mode: selectionMode
            } as Prisma.InputJsonValue
          }
        });

        const license = await this.support.createLicenseWithRetryInTransaction(tx, {
          subscriptionId: subscription.id,
          programCode: program.code,
          maxOfflineHours: input.maxOfflineHours ?? plan.maxOfflineHours
        });

        await tx.auditLog.create({
          data: {
            entityType: 'customer',
            entityId: customer.id,
            action: 'admin_customer_onboard',
            payload: {
              requested_by: requestedBy,
              customer_id: customer.id,
              selection_mode: selectionMode,
              plan_id: plan.id,
              program_id: program.id,
              subscription_id: subscription.id,
              license_id: license.id
            } as Prisma.InputJsonValue
          }
        });

        return {
          customer,
          endUser,
          subscription,
          plan,
          program,
          license
        };
      })
      .catch((error: unknown) => {
        if (error instanceof DomainHttpError) {
          throw error;
        }

        if (this.support.extractPrismaCode(error) === 'P2002') {
          this.support.throwDomainError(
            HttpStatus.CONFLICT,
            'customer_conflict',
            'Customer email already exists with conflicting data'
          );
        }

        throw error;
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
      },
      subscription: {
        id: result.subscription.id,
        status: result.subscription.status,
        startAt: result.subscription.startAt.toISOString(),
        endAt: result.subscription.endAt.toISOString(),
        autoRenew: result.subscription.autoRenew
      },
      plan: {
        id: result.plan.id,
        code: result.plan.code,
        name: result.plan.name,
        maxDevices: result.plan.maxDevices,
        maxOfflineHours: result.plan.maxOfflineHours,
        features: this.support.toStringArray(result.plan.features)
      },
      program: {
        id: result.program.id,
        code: result.program.code,
        name: result.program.name,
        status: result.program.status
      },
      license: {
        id: result.license.id,
        licenseKey: result.license.licenseKey,
        status: result.license.status,
        maxOfflineHours: result.license.maxOfflineHours,
        transferCount: result.license.transferCount,
        createdAt: result.license.createdAt.toISOString(),
        updatedAt: result.license.updatedAt.toISOString()
      }
    };
  }
}
