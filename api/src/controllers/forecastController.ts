import { Response } from 'express';
import { z } from 'zod';
import { Warehouse } from '../models/Warehouse';
import { getForecastForProduct, runReorderCheck } from '../services/forecastService';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthedRequest } from '../types';

const productIdParamSchema = z.object({ productId: z.string().min(1) });

// GET /forecast/:productId              -> forecast across every active warehouse
// GET /forecast/:productId?warehouseId=X -> forecast for just that warehouse
export const getForecast = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { productId } = productIdParamSchema.parse(req.params);
  const { warehouseId } = req.query as Record<string, string>;

  if (warehouseId) {
    const forecast = await getForecastForProduct(productId, warehouseId);
    return res.json({ forecasts: [forecast] });
  }

  const warehouses = await Warehouse.find({ isActive: true });
  const forecasts = await Promise.all(
    warehouses.map((w) => getForecastForProduct(productId, w._id.toString()))
  );
  res.json({ forecasts });
});

// Manual trigger, same pattern as /alerts/run-check — useful for demos.
export const runCheckNow = asyncHandler(async (_req: AuthedRequest, res: Response) => {
  const result = await runReorderCheck();
  res.json(result);
});
