import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './server';

const anchorElWarningPattern = /The `anchorEl` prop provided to the component is invalid/i;
const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
const originalGetClientRects = HTMLElement.prototype.getClientRects;

function hasAnchorElWarning(args: unknown[]): boolean {
  return args.some((arg) => typeof arg === 'string' && anchorElWarningPattern.test(arg));
}

function failOnAnchorElWarning(args: unknown[]): void {
  if (hasAnchorElWarning(args)) {
    throw new Error('Unexpected MUI anchorEl warning during tests.');
  }
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    if (!this.isConnected) {
      return originalGetBoundingClientRect.call(this);
    }

    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 40,
      right: 240,
      width: 240,
      height: 40,
      toJSON: () => ({})
    } as DOMRect;
  };
  HTMLElement.prototype.getClientRects = function getClientRects(): DOMRectList {
    if (!this.isConnected) {
      return originalGetClientRects.call(this);
    }

    const rect = this.getBoundingClientRect();
    return {
      0: rect,
      length: 1,
      item: (index: number) => (index === 0 ? rect : null),
      [Symbol.iterator]: function* iterator() {
        yield rect;
      }
    } as unknown as DOMRectList;
  };
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    failOnAnchorElWarning(args);
    originalConsoleError(...args);
  });
  vi.spyOn(console, 'warn').mockImplementation((...args) => {
    failOnAnchorElWarning(args);
    originalConsoleWarn(...args);
  });
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  vi.restoreAllMocks();
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  HTMLElement.prototype.getClientRects = originalGetClientRects;
  server.close();
});
