import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { runLowStockCheck } from '../services/alertService';
import { runReorderCheck } from '../services/forecastService';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * Scheduled-job endpoints for Vercel Cron (node-cron can't run on a
 * serverless platform — there is no long-lived process to hold a timer).
 * Vercel Cron calls these with GET and, when a CRON_SECRET env var is set,
 * sends `Authorization: Bearer <CRON_SECRET>` automatically. Fails closed:
 * if CRON_SECRET isn't configured, nothing can trigger these.
 */
function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'CRON_SECRET is not configured' });
  }
  const given = Buffer.from(req.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(requireCronSecret);

router.get(
  '/low-stock',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await runLowStockCheck());
  })
);

router.get(
  '/reorder',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await runReorderCheck());
  })
);

export default router;
