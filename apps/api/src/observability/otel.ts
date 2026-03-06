import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | null = null;

function isEnabled(): boolean {
  return (process.env.OTEL_ENABLED ?? 'false').trim().toLowerCase() === 'true';
}

export async function initializeOpenTelemetryFromEnv(): Promise<void> {
  if (!isEnabled() || sdk) {
    return;
  }

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const traceExporter = endpoint
    ? new OTLPTraceExporter({
        url: endpoint
      })
    : new OTLPTraceExporter();

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'sistema-licencas-v2',
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()]
  });

  await sdk.start();
}

export async function shutdownOpenTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }

  await sdk.shutdown().catch(() => undefined);
  sdk = null;
}
