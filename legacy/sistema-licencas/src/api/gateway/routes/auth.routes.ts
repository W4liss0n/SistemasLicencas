import { Router } from 'express';
import { authController } from '../../controllers/auth.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

router.post('/login', (req, res) => authController.login(req, res));
router.get('/me', authenticateToken, (req, res) => authController.me(req as any, res));
router.post('/verify', (req, res) => authController.verify(req as any, res));

export const authRoutes = router;