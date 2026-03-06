import { Router } from 'express';
import { logsController } from '../../controllers/logs.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Logs routes
router.get('/', logsController.getAll);
router.get('/categories', logsController.getCategories);

export const logsRoutes = router;