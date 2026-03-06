import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check for API v2' })
  async health(): Promise<{
    status: 'ok' | 'degraded';
    dependencies: { database: 'up' | 'down'; redis: 'up' | 'down' };
    timestamp: string;
  }> {
    return this.healthService.check();
  }
}