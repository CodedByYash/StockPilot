import { Response } from 'express';
import * as alertService from '../services/alertService';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthedRequest } from '../types';

export const listAlerts = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { resolved } = req.query as Record<string, string>;
  const filter = resolved === undefined ? undefined : resolved === 'true';
  const alerts = await alertService.listAlerts(filter);
  res.json({ alerts });
});

export const resolveAlert = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const alert = await alertService.resolveAlert(req.params.id as string);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  res.json({ alert });
});

// Manual trigger for the low-stock check — useful for demoing without
// waiting for the cron schedule, and for the "run it now" button in the UI.
export const runCheckNow = asyncHandler(async (_req: AuthedRequest, res: Response) => {
  const result = await alertService.runLowStockCheck();
  res.json(result);
});
