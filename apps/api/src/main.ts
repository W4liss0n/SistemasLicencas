import 'reflect-metadata';
import { initializeOpenTelemetryFromEnv, shutdownOpenTelemetry } from './observability/otel';

async function bootstrap(): Promise<void> {
  await initializeOpenTelemetryFromEnv();

  const { createApp } = await import('./bootstrap');
  const { AppConfigService } = await import('./config/app-config.service');

  const app = await createApp();
  const config = app.get(AppConfigService);

  const shutdown = async (): Promise<void> => {
    await app.close().catch(() => undefined);
    await shutdownOpenTelemetry();
  };

  process.once('SIGINT', () => {
    shutdown()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });

  process.once('SIGTERM', () => {
    shutdown()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });

  await app.listen({
    host: '0.0.0.0',
    port: config.port
  });
}

bootstrap().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap app', error);
  await shutdownOpenTelemetry().catch(() => undefined);
  process.exit(1);
});
