import { Router } from 'express';
import {
  listSalesOrders,
  getSalesOrder,
  createSalesOrder,
  fulfillSalesOrder,
  cancelSalesOrder,
} from '../controllers/salesOrderController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', listSalesOrders);
router.get('/:id', getSalesOrder);
router.post('/', requireRole('admin', 'manager', 'staff'), createSalesOrder);
router.patch('/:id/fulfill', requireRole('admin', 'manager', 'staff'), fulfillSalesOrder);
router.patch('/:id/cancel', requireRole('admin', 'manager'), cancelSalesOrder);

export default router;
