import { Router } from 'express';
import { assinaturasController } from '../../controllers/assinaturas.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', (req, res) => assinaturasController.getAll(req, res));
router.get('/:id', (req, res) => assinaturasController.getById(req, res));
router.post('/', (req, res) => assinaturasController.create(req, res));
router.put('/:id', (req, res) => assinaturasController.update(req, res));
router.post('/:id/cancel', (req, res) => assinaturasController.cancel(req, res));

export const assinaturasRoutes = router;