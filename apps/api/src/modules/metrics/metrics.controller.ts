import { Controller, Get, HttpCode, Inject, NotFoundException, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { AppConfigService } from '../../config/app-config.service';
import { MetricsService } from '../../observability/metrics.service';

@Controller()
export class MetricsController {
  constructor(
    @Inject(AppConfigService) private readonly appConfigService: AppConfigService,
    @Inject(MetricsService) private readonly metricsService: MetricsService
  ) {}

  @Get('metrics')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async metrics(@Res() reply: FastifyReply): Promise<void> {
    if (!this.appConfigService.metricsEnabled) {
      throw new NotFoundException('Metrics endpoint is disabled');
    }

    const payload = await this.metricsService.renderMetrics();
    reply.header('content-type', this.metricsService.contentType);
    reply.send(payload);
  }
}
