import { Router } from 'express';
import { programasController } from '../../controllers/programas.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', (req, res) => programasController.getAll(req, res));
router.get('/:id', (req, res) => programasController.getById(req, res));
router.post('/', (req, res) => programasController.create(req, res));
router.put('/:id', (req, res) => programasController.update(req, res));
router.delete('/:id', (req, res) => programasController.delete(req, res));

export const programasRoutes = router;