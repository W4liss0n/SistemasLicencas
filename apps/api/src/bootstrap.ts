import {
  FastifyAdapter,
  type NestFastifyApplication
} from '@nestjs/platform-fastify';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { runWithTraceId } from './common/request-context/request-context';
import { TraceIdInterceptor } from './common/interceptors/trace-id.interceptor';
import { AppConfigService } from './config/app-config.service';
import { MetricsService } from './observability/metrics.service';

const requestStartTimeSymbol = Symbol('requestStartTime');

export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true
  });

  const configService = app.get(AppConfigService);
  const metricsService = app.get(MetricsService);

  await app.register(helmet);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      type: 'https://docs.sistema-licencas.dev/problems/rate-limit-exceeded',
      title: 'Too Many Requests',
      statusCode: 429,
      code: 'rate_limit_exceeded',
      detail: `Rate limit exceeded: ${context.max} requests per ${context.after}`
    })
  });

  const fastify = app.getHttpAdapter().getInstance();

  fastify.addHook('onRequest', (request, reply, done) => {
    const incoming = request.headers['x-request-id'];
    const traceId = typeof incoming === 'string' && incoming.trim().length > 0 ? incoming : randomUUID();
    request.headers['x-request-id'] = traceId;
    reply.header('x-request-id', traceId);
    (request as unknown as Record<symbol, bigint>)[requestStartTimeSymbol] = process.hrtime.bigint();
    runWithTraceId(traceId, done);
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    if (configService.metricsEnabled) {
      const start = (request as unknown as Record<symbol, bigint>)[requestStartTimeSymbol];
      const route =
        (request.routeOptions?.url as string | undefined) ??
        request.url.split('?')[0] ??
        'unknown';

      const durationMs =
        typeof start === 'bigint' ? Number((process.hrtime.bigint() - start) / BigInt(1e6)) : 0;

      metricsService.recordHttpRequest({
        method: request.method,
        route,
        statusCode: reply.statusCode,
        durationMs
      });
    }

    done();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  app.useGlobalInterceptors(new TraceIdInterceptor());
  app.useGlobalFilters(new ProblemDetailsFilter(metricsService));

  app.setGlobalPrefix(configService.apiPrefix.replace(/^\//, ''), {
    exclude: [{ path: '.well-known/jwks.json', method: RequestMethod.GET }]
  });

  if (configService.metricsEnabled) {
    const normalized = configService.metricsPath.startsWith('/')
      ? configService.metricsPath
      : `/${configService.metricsPath}`;

    if (normalized !== '/metrics') {
      const fullPath = `${configService.apiPrefix}${normalized}`.replace(/\/{2,}/g, '/');
      fastify.get(fullPath, async (_request, reply) => {
        const metricsPayload = await metricsService.renderMetrics();
        reply.header('content-type', metricsService.contentType);
        reply.send(metricsPayload);
      });
    }
  }

  const documentConfig = new DocumentBuilder()
    .setTitle('Sistema Licencas API v2')
    .setDescription('Contract-first API for licensing runtime rewrite')
    .setVersion('2.0.0')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Request-Id'
      },
      'request-id'
    )
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);
  document.openapi = '3.1.0';

  return app;
}

