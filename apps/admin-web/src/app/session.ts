const OPERATOR_CONTEXT_KEY = 'admin-web-operator';

// Browser storage only keeps operator context for UI and audit fields.
// Real access control remains enforced by the internal proxy and API edge.
export function getOperatorContextName(): string | null {
  const value = sessionStorage.getItem(OPERATOR_CONTEXT_KEY);
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value;
}

export function hasOperatorContext(): boolean {
  return getOperatorContextName() !== null;
}

export function setOperatorContextName(value: string): void {
  sessionStorage.setItem(OPERATOR_CONTEXT_KEY, value.trim());
}

export function clearOperatorContextName(): void {
  sessionStorage.removeItem(OPERATOR_CONTEXT_KEY);
}
