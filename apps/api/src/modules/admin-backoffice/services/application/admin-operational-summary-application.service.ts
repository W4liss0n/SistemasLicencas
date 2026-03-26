import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_BACKOFFICE_PORT, type AdminBackofficePort } from '../../ports/admin-backoffice.port';
import type { AdminOperationalSummaryResponseDto } from '../../dto/admin-backoffice.dto';
import { toOperationalSummaryResponseDto } from '../admin-backoffice-response.mapper';

@Injectable()
export class AdminOperationalSummaryApplicationService {
  constructor(
    @Inject(ADMIN_BACKOFFICE_PORT) private readonly adminBackoffice: AdminBackofficePort
  ) {}

  async getOperationalSummary(
    windowDays?: number
  ): Promise<AdminOperationalSummaryResponseDto> {
    const result = await this.adminBackoffice.getOperationalSummary({ windowDays });
    return toOperationalSummaryResponseDto(result);
  }
}
