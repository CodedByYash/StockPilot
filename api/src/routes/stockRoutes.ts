import { Router } from 'express';
import { createMovement, getCurrentStock, getHistory } from '../controllers/stockController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.post('/movements', requireRole('admin', 'manager', 'staff'), createMovement);
router.get('/:productId/:warehouseId', getCurrentStock);
router.get('/:productId/history', getHistory);

export default router;
