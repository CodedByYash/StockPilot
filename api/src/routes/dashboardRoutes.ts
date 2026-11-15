import { Router } from 'express';
import { getSummary } from '../controllers/dashboardController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/summary', getSummary);

export default router;
