import { Router } from 'express';
import { LicenseController } from '../../../gateway/controllers/license.controller';
import { rateLimiter } from '../../middleware/rate-limit.middleware';
import { validateRequest } from '../../middleware/validation.middleware';

const router = Router();

// Global rate limiter for all routes
router.use(rateLimiter);

/**
 * @route POST /api/v1/license/authenticate
 * @desc Authenticate client with username/email and password, returns license key
 * @access Public (rate limited)
 */
router.post('/authenticate',
  LicenseController.authenticateClient
);

/**
 * @route POST /api/v1/license/validate
 * @desc Validate a license key
 * @access Requires Program ID header
 */
router.post('/validate',
  validateRequest('licenseValidation'),
  LicenseController.validateLicense
);

/**
 * @route POST /api/v1/license/activate
 * @desc Activate a license on a new device
 * @access Requires Program ID header
 */
router.post('/activate',
  validateRequest('licenseActivation'),
  LicenseController.activateLicense
);

/**
 * @route POST /api/v1/license/heartbeat
 * @desc Send heartbeat for online validation
 * @access Requires Program ID header
 */
router.post('/heartbeat',
  validateRequest('licenseHeartbeat'),
  LicenseController.heartbeat
);

/**
 * @route POST /api/v1/license/deactivate
 * @desc Deactivate a license
 * @access Requires Program ID header
 */
router.post('/deactivate',
  validateRequest('licenseDeactivation'),
  LicenseController.deactivateLicense
);

/**
 * @route POST /api/v1/license/transfer
 * @desc Transfer license to a new device
 * @access Requires Program ID header
 */
router.post('/transfer',
  validateRequest('licenseTransfer'),
  LicenseController.transferLicense
);

export { router as licenseRoutes };
