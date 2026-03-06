import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly register = new Registry();

  private readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests handled by the API',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.register]
  });

  private readonly httpRequestDurationMs = new Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [this.register]
  });

  private readonly licenseRuntimeFailuresTotal = new Counter({
    name: 'license_runtime_failures_total',
    help: 'Total licensing runtime failures grouped by canonical code and endpoint',
    labelNames: ['code', 'endpoint'],
    registers: [this.register]
  });

  private readonly idempotencyReplayTotal = new Counter({
    name: 'idempotency_replay_total',
    help: 'Total idempotency replay hits grouped by endpoint',
    labelNames: ['endpoint'],
    registers: [this.register]
  });

  private readonly authLoginSuccessTotal = new Counter({
    name: 'auth_login_success_total',
    help: 'Total successful end-user logins grouped by program',
    labelNames: ['program_code'],
    registers: [this.register]
  });

  private readonly authLoginFailureTotal = new Counter({
    name: 'auth_login_failure_total',
    help: 'Total failed end-user logins grouped by error code and program',
    labelNames: ['code', 'program_code'],
    registers: [this.register]
  });

  private readonly authOidcLoginSuccessTotal = new Counter({
    name: 'auth_oidc_login_success_total',
    help: 'Total successful OIDC browser logins grouped by program',
    labelNames: ['program_code'],
    registers: [this.register]
  });

  private readonly authOidcLoginFailureTotal = new Counter({
    name: 'auth_oidc_login_failure_total',
    help: 'Total failed OIDC browser logins grouped by error code and program',
    labelNames: ['code', 'program_code'],
    registers: [this.register]
  });

  private readonly authOidcLoginPendingTotal = new Counter({
    name: 'auth_oidc_login_pending_total',
    help: 'Total OIDC logins waiting for plan assignment grouped by program',
    labelNames: ['program_code'],
    registers: [this.register]
  });

  private readonly authOidcCodeExchangeFailureTotal = new Counter({
    name: 'auth_oidc_code_exchange_failure_total',
    help: 'Total OIDC token/code exchange failures grouped by reason',
    labelNames: ['reason'],
    registers: [this.register]
  });

  private readonly offlineLoginAttemptTotal = new Counter({
    name: 'offline_login_attempt_total',
    help: 'Total offline token issuance attempts grouped by result',
    labelNames: ['result'],
    registers: [this.register]
  });

  private readonly offlineLoginBlockedTotal = new Counter({
    name: 'offline_login_blocked_total',
    help: 'Total offline login blocks grouped by reason',
    labelNames: ['reason'],
    registers: [this.register]
  });

  private readonly clockTamperDetectedTotal = new Counter({
    name: 'clock_tamper_detected_total',
    help: 'Total clock tamper detections reported by clients',
    labelNames: ['source'],
    registers: [this.register]
  });

  private readonly refreshReplayDetectedTotal = new Counter({
    name: 'refresh_replay_detected_total',
    help: 'Total refresh token replay detections grouped by program',
    labelNames: ['program_code'],
    registers: [this.register]
  });

  get contentType(): string {
    return this.register.contentType;
  }

  async renderMetrics(): Promise<string> {
    return this.register.metrics();
  }

  recordHttpRequest(params: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }): void {
    const labels = {
      method: params.method,
      route: params.route,
      status_code: `${params.statusCode}`
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationMs.observe(labels, params.durationMs);
  }

  incrementLicenseFailure(code: string, endpoint: string): void {
    this.licenseRuntimeFailuresTotal.inc({
      code,
      endpoint
    });
  }

  incrementIdempotencyReplay(endpoint: string): void {
    this.idempotencyReplayTotal.inc({ endpoint });
  }

  incrementAuthLoginSuccess(programCode: string): void {
    this.authLoginSuccessTotal.inc({ program_code: programCode });
  }

  incrementAuthLoginFailure(code: string, programCode: string): void {
    this.authLoginFailureTotal.inc({ code, program_code: programCode });
  }

  incrementAuthOidcLoginSuccess(programCode: string): void {
    this.authOidcLoginSuccessTotal.inc({ program_code: programCode });
  }

  incrementAuthOidcLoginFailure(code: string, programCode: string): void {
    this.authOidcLoginFailureTotal.inc({ code, program_code: programCode });
  }

  incrementAuthOidcLoginPending(programCode: string): void {
    this.authOidcLoginPendingTotal.inc({ program_code: programCode });
  }

  incrementAuthOidcCodeExchangeFailure(reason: string): void {
    this.authOidcCodeExchangeFailureTotal.inc({ reason });
  }

  incrementOfflineLoginAttempt(result: string): void {
    this.offlineLoginAttemptTotal.inc({ result });
  }

  incrementOfflineLoginBlocked(reason: string): void {
    this.offlineLoginBlockedTotal.inc({ reason });
  }

  incrementClockTamperDetected(source: string): void {
    this.clockTamperDetectedTotal.inc({ source });
  }

  incrementRefreshReplayDetected(programCode: string): void {
    this.refreshReplayDetectedTotal.inc({ program_code: programCode });
  }
}
