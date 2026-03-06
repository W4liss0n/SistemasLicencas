import { Router } from 'express';
import { dashboardController } from '../../controllers/dashboard.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/stats', (req, res) => dashboardController.getStats(req, res));
router.get('/events', (req, res) => dashboardController.getRecentEvents(req, res));
router.get('/licenses', (req, res) => dashboardController.getLicenseData(req, res));
router.get('/security', (req, res) => dashboardController.getSecurityData(req, res));

export const dashboardRoutes = router;