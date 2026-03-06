import type { SubscriptionStatus } from '@prisma/client';

export type SubscriptionReadFailureCode =
  | 'license_not_found'
  | 'license_blocked'
  | 'subscription_expired';

export interface SubscriptionReadFailure {
  ok: false;
  code: SubscriptionReadFailureCode;
  detail: string;
}

export interface SubscriptionDeviceContext {
  id: string;
  isActive: boolean;
  fingerprintHash: string;
}

export interface SubscriptionLicenseContext {
  license: {
    id: string;
    licenseKey: string;
    maxOfflineHours: number;
  };
  subscription: {
    id: string;
    planId: string;
    status: SubscriptionStatus;
    endAt: Date;
  };
  devices: SubscriptionDeviceContext[];
}

export interface SubscriptionReadSuccess {
  ok: true;
  context: SubscriptionLicenseContext;
}

export type SubscriptionReadResult = SubscriptionReadSuccess | SubscriptionReadFailure;

export const SUBSCRIPTION_READ_PORT = Symbol('SUBSCRIPTION_READ_PORT');

export interface SubscriptionReadPort {
  loadEligibleLicense(licenseKey: string): Promise<SubscriptionReadResult>;
}