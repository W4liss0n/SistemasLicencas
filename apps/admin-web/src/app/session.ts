import {
  readSessionStorage,
  removeSessionStorage,
  writeSessionStorage
} from './browser-storage';
import {
  clearAdminAuthSession,
  getAdminAuthOperatorName,
  hasAdminAuthSession,
  isAdminAuthEnabled
} from './admin-auth';

const OPERATOR_CONTEXT_KEY = 'admin-web-operator';

// Browser storage only keeps operator context for UI and audit fields.
// Real access control remains enforced by the internal proxy and API edge.
export function getOperatorContextName(): string | null {
  if (isAdminAuthEnabled()) {
    return getAdminAuthOperatorName();
  }

  const value = readSessionStorage(OPERATOR_CONTEXT_KEY);
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value;
}

export function hasOperatorContext(): boolean {
  if (isAdminAuthEnabled()) {
    return hasAdminAuthSession();
  }

  return getOperatorContextName() !== null;
}

export function setOperatorContextName(value: string): void {
  writeSessionStorage(OPERATOR_CONTEXT_KEY, value.trim());
}

export function clearOperatorContextName(): void {
  clearAdminAuthSession();
  removeSessionStorage(OPERATOR_CONTEXT_KEY);
}
