import { Router } from 'express';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', requireRole('admin', 'manager'), createProduct);
router.patch('/:id', requireRole('admin', 'manager'), updateProduct);
router.delete('/:id', requireRole('admin'), deleteProduct);

export default router;
