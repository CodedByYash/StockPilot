import { Response } from 'express';
import { z } from 'zod';
import * as barcodeService from '../services/barcodeService';
import { MOVEMENT_TYPES, REFERENCE_TYPES } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthedRequest } from '../types';

export const lookup = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { code } = req.params;
  const result = await barcodeService.lookupByBarcode(code as string);
  res.json(result);
});

const recordByBarcodeSchema = z.object({
  barcode: z.string().min(1),
  warehouseId: z.string().min(1),
  type: z.enum(MOVEMENT_TYPES),
  quantity: z.number().positive(),
  referenceType: z.enum(REFERENCE_TYPES).optional(),
  referenceId: z.string().optional(),
  lotNumber: z.string().optional(),
});

export const recordMovement = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const body = recordByBarcodeSchema.parse(req.body);
  const result = await barcodeService.recordMovementByBarcode({
    ...body,
    createdBy: req.user!.userId,
  });
  res.status(201).json(result);
});
