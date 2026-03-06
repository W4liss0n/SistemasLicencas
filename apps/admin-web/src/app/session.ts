const OPERATOR_KEY = 'admin-web-operator';

export function getOperatorName(): string | null {
  const value = sessionStorage.getItem(OPERATOR_KEY);
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value;
}

export function setOperatorName(value: string): void {
  sessionStorage.setItem(OPERATOR_KEY, value.trim());
}

export function clearOperatorName(): void {
  sessionStorage.removeItem(OPERATOR_KEY);
}
