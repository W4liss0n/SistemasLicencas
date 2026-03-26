export const ADMIN_BACKOFFICE_ENDPOINTS = {
  createProgram: '/api/v2/internal/admin/programs',
  createPlan: '/api/v2/internal/admin/plans',
  updatePlan: (planId: string) => `/api/v2/internal/admin/plans/${planId}`,
  createCustomer: '/api/v2/internal/admin/customers',
  onboardCustomer: '/api/v2/internal/admin/customers/onboard',
  provision: '/api/v2/internal/admin/licenses',
  renew: (licenseKey: string) => `/api/v2/internal/admin/licenses/${licenseKey}/renew`,
  updateLicense: (licenseKey: string) => `/api/v2/internal/admin/licenses/${licenseKey}`,
  block: (licenseKey: string) => `/api/v2/internal/admin/licenses/${licenseKey}/block`,
  unblock: (licenseKey: string) => `/api/v2/internal/admin/licenses/${licenseKey}/unblock`,
  cancel: (licenseKey: string) => `/api/v2/internal/admin/licenses/${licenseKey}/cancel`
} as const;
