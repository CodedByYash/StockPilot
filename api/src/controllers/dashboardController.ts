import { Response } from 'express';
import { getDashboardSummary } from '../services/dashboardService';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthedRequest } from '../types';

export const getSummary = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { warehouseId } = req.query as Record<string, string>;
  const summary = await getDashboardSummary(warehouseId);
  res.json(summary);
});
