import { Response } from 'express';
import { z } from 'zod';
import * as stockService from '../services/stockService';
import { MOVEMENT_TYPES, REFERENCE_TYPES } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthedRequest } from '../types';

const recordMovementSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  type: z.enum(MOVEMENT_TYPES),
  quantity: z.number().positive(),
  referenceType: z.enum(REFERENCE_TYPES),
  referenceId: z.string().optional(),
  lotNumber: z.string().optional(),
  expiryDate: z.coerce.date().optional(),
});

// Manual adjustments (the UI path for "correct stock count", "damaged goods",
// initial stock load) always go through this same endpoint — 'manual' as
// referenceType and 'adjustment' or 'outbound' as type depending on direction.
export const createMovement = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const body = recordMovementSchema.parse(req.body);

  const result = await stockService.recordMovement({
    ...body,
    createdBy: req.user!.userId,
  });

  res.status(201).json(result);
});

const paramsSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
});

const productIdParamSchema = z.object({ productId: z.string().min(1) });

export const getCurrentStock = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { productId, warehouseId } = paramsSchema.parse(req.params);
  const quantity = await stockService.getCurrentStock(productId, warehouseId);
  res.json({ productId, warehouseId, quantity });
});

export const getHistory = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { productId } = productIdParamSchema.parse(req.params);
  const { warehouseId, limit } = req.query as Record<string, string>;
  const history = await stockService.getMovementHistory(
    productId,
    warehouseId,
    limit ? parseInt(limit, 10) : undefined
  );
  res.json({ history });
});
