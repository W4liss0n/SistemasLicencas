import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  traceId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

export function runWithTraceId(traceId: string, callback: () => void): void {
  storage.run({ traceId }, callback);
}

export function getTraceId(): string {
  return storage.getStore()?.traceId ?? randomUUID();
}
