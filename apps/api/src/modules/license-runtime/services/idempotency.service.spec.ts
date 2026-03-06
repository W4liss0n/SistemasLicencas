import { DomainHttpError } from '../../../common/errors/domain-http-error';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  const prismaMock = {} as any;
  const configMock = {
    nodeEnv: 'test',
    idempotencyTtlHours: 24
  } as any;

  it('executes first request and replays identical retries', async () => {
    const service = new IdempotencyService(prismaMock, configMock);
    const executeSpy = jest.fn(async () => ({
      statusCode: 200,
      body: { success: true, value: 1 }
    }));

    const first = await service.execute({
      endpoint: '/api/v2/licenses/transfer',
      idempotencyKey: 'idem-1',
      payload: { a: 1, b: 2 },
      execute: executeSpy
    });

    const replay = await service.execute({
      endpoint: '/api/v2/licenses/transfer',
      idempotencyKey: 'idem-1',
      payload: { b: 2, a: 1 },
      execute: executeSpy
    });

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.body).toEqual({ success: true, value: 1 });
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('throws conflict when same key is reused with different payload', async () => {
    const service = new IdempotencyService(prismaMock, configMock);

    await service.execute({
      endpoint: '/api/v2/licenses/deactivate',
      idempotencyKey: 'idem-2',
      payload: { a: 1 },
      execute: async () => ({
        statusCode: 200,
        body: { success: true }
      })
    });

    await expect(
      service.execute({
        endpoint: '/api/v2/licenses/deactivate',
        idempotencyKey: 'idem-2',
        payload: { a: 2 },
        execute: async () => ({
          statusCode: 200,
          body: { success: true }
        })
      })
    ).rejects.toThrow(DomainHttpError);

    try {
      await service.execute({
        endpoint: '/api/v2/licenses/deactivate',
        idempotencyKey: 'idem-2',
        payload: { a: 2 },
        execute: async () => ({
          statusCode: 200,
          body: { success: true }
        })
      });
    } catch (error) {
      const domainError = error as DomainHttpError;
      expect(domainError.getStatus()).toBe(409);
      expect((domainError.getResponse() as { code: string }).code).toBe(
        'idempotency_key_conflict'
      );
    }
  });
});
