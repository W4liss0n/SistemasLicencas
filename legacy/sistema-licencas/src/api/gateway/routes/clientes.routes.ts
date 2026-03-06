import { Router } from 'express';
import { clientesController } from '../../controllers/clientes.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', (req, res) => clientesController.getAll(req, res));
router.get('/:id', (req, res) => clientesController.getById(req, res));
router.post('/', (req, res) => clientesController.create(req, res));
router.put('/:id', (req, res) => clientesController.update(req, res));
router.delete('/:id', (req, res) => clientesController.delete(req, res));

export const clientesRoutes = router;