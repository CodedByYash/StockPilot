import { Router } from 'express';
import { getForecast, runCheckNow } from '../controllers/forecastController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/:productId', getForecast);
router.post('/run-check', requireRole('admin', 'manager'), runCheckNow);

export default router;
