import { SetMetadata } from '@nestjs/common';

export const ADMIN_AUTH_SCOPES_KEY = 'admin-auth-scopes';

export function AdminAuthScopes(...scopes: string[]) {
  return SetMetadata(ADMIN_AUTH_SCOPES_KEY, scopes);
}
