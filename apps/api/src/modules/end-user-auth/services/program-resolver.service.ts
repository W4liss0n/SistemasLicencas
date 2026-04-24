import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DomainHttpError } from '../../../common/errors/domain-http-error';
import {
  CATALOG_BILLING_POLICY_PORT,
  CatalogBillingPolicyPort
} from '../../catalog-billing/ports/catalog-billing-policy.port';
import type { AuthProgram } from './auth-session.types';

@Injectable()
export class ProgramResolverService {
  constructor(
    @Inject(CATALOG_BILLING_POLICY_PORT)
    private readonly catalogBillingPolicy: CatalogBillingPolicyPort
  ) {}

  async resolve(programId: string): Promise<AuthProgram> {
    const program = await this.catalogBillingPolicy.resolveAuthorizedProgram(programId);
    if (!program.ok) {
      throw new DomainHttpError({
        status: HttpStatus.UNAUTHORIZED,
        code: 'unauthorized_program',
        detail: program.detail,
        title: 'Unauthorized program'
      });
    }

    return {
      id: program.program.id,
      code: program.program.code
    };
  }
}
