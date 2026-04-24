import type { ResolvedEntitlement } from './entitlement-resolver.service';

export interface AccessTokenClaims {
  type: 'access';
  sub: string;
  sid: string;
  program_id: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenClaims {
  type: 'refresh';
  sub: string;
  sid: string;
  program_id: string;
  iat?: number;
  exp?: number;
}

export type AuthProgram = {
  id: string;
  code: string;
};

export type AuthUserForLogin = {
  id: string;
  customerId: string;
  status: 'active' | 'blocked';
  oidcIssuer: string | null;
  oidcSubject: string | null;
};

export type OidcIdentity = {
  issuer: string;
  subject: string;
  email: string;
  name: string | null;
};

export function toEntitlementResponse(entitlement: ResolvedEntitlement) {
  return {
    customer_id: entitlement.customerId,
    subscription_id: entitlement.subscriptionId,
    plan_code: entitlement.planCode,
    plan_name: entitlement.planName,
    program_id: entitlement.programId,
    program_code: entitlement.programCode,
    features: entitlement.features
  };
}
