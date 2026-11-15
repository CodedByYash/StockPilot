import { Router } from 'express';
import { lookup, recordMovement } from '../controllers/barcodeController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// GET /barcode/:code -> product + stock-per-warehouse for a scanned code
router.get('/:code', lookup);

// POST /barcode/movements -> scan-to-record a stock movement directly
router.post('/movements', requireRole('admin', 'manager', 'staff'), recordMovement);

export default router;
