import { Router } from 'express';
import {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  markOrdered,
  receivePurchaseOrder,
} from '../controllers/purchaseOrderController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', listPurchaseOrders);
router.get('/:id', getPurchaseOrder);
router.post('/', requireRole('admin', 'manager'), createPurchaseOrder);
router.patch('/:id/mark-ordered', requireRole('admin', 'manager'), markOrdered);
router.patch('/:id/receive', requireRole('admin', 'manager', 'staff'), receivePurchaseOrder);

export default router;
