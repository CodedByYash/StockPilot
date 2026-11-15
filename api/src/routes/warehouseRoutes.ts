import { Router } from 'express';
import {
  listWarehouses,
  createWarehouse,
  updateWarehouse,
  deactivateWarehouse,
} from '../controllers/warehouseController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', listWarehouses);
router.post('/', requireRole('admin'), createWarehouse);
router.patch('/:id', requireRole('admin'), updateWarehouse);
router.delete('/:id', requireRole('admin'), deactivateWarehouse);

export default router;
