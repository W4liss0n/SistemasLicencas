export interface IssueOfflineTokenInput {
  licenseKey: string;
  fingerprintHash: string;
  issuedAt?: Date;
}

export interface IssueOfflineSessionTokenInput {
  userId: string;
  sessionId: string;
  programId: string;
  fingerprintHash: string;
  entitlements: string[];
  maxOfflineHours?: number;
  issuedAt?: Date;
}

export interface OfflineSessionJwk {
  [key: string]: unknown;
  kid: string;
  kty: string;
}

export interface OfflineSessionJwks {
  keys: OfflineSessionJwk[];
}

export const OFFLINE_ENTITLEMENT_PORT = Symbol('OFFLINE_ENTITLEMENT_PORT');

export interface OfflineEntitlementPort {
  issueOfflineToken(input: IssueOfflineTokenInput): string;
  issueOfflineSessionToken(input: IssueOfflineSessionTokenInput): Promise<{
    token: string;
    expiresAt: string;
  }>;
  getOfflineSessionJwks(): Promise<OfflineSessionJwks>;
}
