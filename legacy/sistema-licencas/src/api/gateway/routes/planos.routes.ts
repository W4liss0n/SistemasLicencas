import { Router } from 'express';
import { planosController } from '../../controllers/planos.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', (req, res) => planosController.getAll(req, res));
router.get('/:id', (req, res) => planosController.getById(req, res));
router.post('/', (req, res) => planosController.create(req, res));
router.put('/:id', (req, res) => planosController.update(req, res));
router.delete('/:id', (req, res) => planosController.delete(req, res));

// Rotas para gerenciar programas do plano
router.get('/:id/programas', (req, res) => planosController.getProgramas(req, res));
router.post('/:id/programas', (req, res) => planosController.addPrograma(req, res));
router.delete('/:id/programas/:programaId', (req, res) => planosController.removePrograma(req, res));

export const planosRoutes = router;