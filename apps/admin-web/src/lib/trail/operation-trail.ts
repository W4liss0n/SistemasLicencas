import type { OperationTrailEntry } from '../../types/api';

const TRAIL_KEY = 'admin-web-license-trail';

function readRaw(): OperationTrailEntry[] {
  const raw = sessionStorage.getItem(TRAIL_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as OperationTrailEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendOperationTrail(entry: OperationTrailEntry): void {
  const existing = readRaw().filter((item) => item.licenseKey === entry.licenseKey);
  const next = [entry, ...existing].slice(0, 10);
  const full = [
    ...readRaw().filter((item) => item.licenseKey !== entry.licenseKey),
    ...next
  ];
  sessionStorage.setItem(TRAIL_KEY, JSON.stringify(full));
}

export function readOperationTrail(licenseKey: string): OperationTrailEntry[] {
  return readRaw()
    .filter((entry) => entry.licenseKey === licenseKey)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}
