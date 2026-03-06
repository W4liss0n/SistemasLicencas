import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getTraceId } from '../request-context/request-context';
import { MetricsService } from '../../observability/metrics.service';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance: string;
  trace_id: string;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly metricsService?: MetricsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    const traceId = getTraceId();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let exceptionResponse: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      exceptionResponse = exception.getResponse();
    } else if (exception && typeof exception === 'object') {
      const maybeError = exception as Record<string, unknown>;
      if (typeof maybeError.statusCode === 'number') {
        status = maybeError.statusCode;
      }
      exceptionResponse = maybeError;
    }

    const base: ProblemDetails = {
      type: 'about:blank',
      title: 'Unexpected error',
      status,
      code: 'internal_error',
      detail: 'An internal error occurred',
      instance: request.url,
      trace_id: traceId
    };

    if (typeof exceptionResponse === 'string') {
      base.detail = exceptionResponse;
      base.title = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const record = exceptionResponse as Record<string, unknown>;
      if (typeof record.message === 'string') {
        base.detail = record.message;
        base.title = record.message;
      } else if (Array.isArray(record.message)) {
        base.detail = record.message.join(', ');
        base.title = 'Validation error';
      }
      if (typeof record.code === 'string') {
        base.code = record.code;
      }
      if (typeof record.title === 'string') {
        base.title = record.title;
      }
      if (typeof record.type === 'string') {
        base.type = record.type;
      }
      if (typeof record.error === 'string' && base.title === 'Unexpected error') {
        base.title = record.error;
      }
    }

    if (status === HttpStatus.BAD_REQUEST && base.code === 'internal_error') {
      base.code = 'invalid_request';
      base.type = 'https://docs.sistema-licencas.dev/problems/invalid-request';
    }

    if (status === HttpStatus.UNAUTHORIZED && base.code === 'internal_error') {
      base.code = 'invalid_credentials';
      base.type = 'https://docs.sistema-licencas.dev/problems/invalid-credentials';
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS && base.code === 'internal_error') {
      base.code = 'rate_limit_exceeded';
      base.type = 'https://docs.sistema-licencas.dev/problems/rate-limit-exceeded';
      if (base.title === 'Unexpected error') {
        base.title = 'Too Many Requests';
      }
    }

    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`trace_id=${traceId} ${stack}`);
      base.type = 'https://docs.sistema-licencas.dev/problems/internal-error';
      base.title = 'Internal server error';
      base.detail = 'An internal error occurred';
      base.code = 'internal_error';
    }

    const endpoint = request.url.split('?')[0];
    if (status >= 400 && endpoint.startsWith('/api/v2/license')) {
      this.metricsService?.incrementLicenseFailure(base.code, endpoint);
    }

    response
      .code(status)
      .header('content-type', 'application/problem+json')
      .header('x-request-id', traceId)
      .send(base);
  }
}
