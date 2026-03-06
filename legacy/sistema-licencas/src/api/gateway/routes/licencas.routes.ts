import { Router } from 'express';
import { licencasController } from '../../controllers/licencas.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', (req, res) => licencasController.getAll(req, res));
router.get('/:id', (req, res) => licencasController.getById(req, res));
router.post('/', (req, res) => licencasController.create(req, res));
router.put('/:id', (req, res) => licencasController.update(req, res));
router.post('/:id/block', (req, res) => licencasController.block(req, res));
router.post('/:id/unblock', (req, res) => licencasController.unblock(req, res));

// Device management routes
router.get('/key/:licenseKey/devices', (req, res) => licencasController.getDevicesByLicenseKey(req, res));
router.post('/key/:licenseKey/devices/:fingerprintHash/deactivate', (req, res) => licencasController.deactivateDeviceByFingerprint(req, res));

export const licencasRoutes = router;