import { Router } from 'express';
import { listAlerts, resolveAlert, runCheckNow } from '../controllers/alertController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', listAlerts);
router.patch('/:id/resolve', requireRole('admin', 'manager', 'staff'), resolveAlert);
router.post('/run-check', requireRole('admin', 'manager'), runCheckNow);

export default router;
