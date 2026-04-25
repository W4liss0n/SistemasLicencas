type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isBrowserStorage(value: unknown): value is BrowserStorage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as BrowserStorage).getItem === 'function' &&
    typeof (value as BrowserStorage).setItem === 'function' &&
    typeof (value as BrowserStorage).removeItem === 'function'
  );
}

function resolveStorage(kind: 'localStorage' | 'sessionStorage'): BrowserStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storage = window[kind];
  return isBrowserStorage(storage) ? storage : null;
}

function readStorage(kind: 'localStorage' | 'sessionStorage', key: string): string | null {
  try {
    return resolveStorage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(kind: 'localStorage' | 'sessionStorage', key: string, value: string): void {
  try {
    resolveStorage(kind)?.setItem(key, value);
  } catch {
    // Ignore unavailable browser storage and keep the UI functional.
  }
}

function removeStorage(kind: 'localStorage' | 'sessionStorage', key: string): void {
  try {
    resolveStorage(kind)?.removeItem(key);
  } catch {
    // Ignore unavailable browser storage and keep the UI functional.
  }
}

export function readLocalStorage(key: string): string | null {
  return readStorage('localStorage', key);
}

export function writeLocalStorage(key: string, value: string): void {
  writeStorage('localStorage', key, value);
}

export function readSessionStorage(key: string): string | null {
  return readStorage('sessionStorage', key);
}

export function writeSessionStorage(key: string, value: string): void {
  writeStorage('sessionStorage', key, value);
}

export function removeSessionStorage(key: string): void {
  removeStorage('sessionStorage', key);
}
