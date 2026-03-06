import { Router } from 'express';
import { adminsController } from '../../controllers/admins.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);

// Admin routes
router.get('/', adminsController.getAll);
router.get('/:id', adminsController.getById);
router.post('/', adminsController.create);
router.put('/:id', adminsController.update);
router.delete('/:id', adminsController.delete);
router.post('/:id/reset-password', adminsController.resetPassword);

export const adminsRoutes = router;