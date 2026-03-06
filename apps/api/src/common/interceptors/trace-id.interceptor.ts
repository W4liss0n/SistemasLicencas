import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { getTraceId } from '../request-context/request-context';

@Injectable()
export class TraceIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const traceId = getTraceId();
    const response = context.switchToHttp().getResponse();
    response.header('x-request-id', traceId);

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          return {
            ...(data as Record<string, unknown>),
            trace_id: (data as Record<string, unknown>).trace_id ?? traceId
          };
        }
        return data;
      })
    );
  }
}
