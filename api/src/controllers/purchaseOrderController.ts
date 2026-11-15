import { Response } from 'express';
import { z } from 'zod';
import { PurchaseOrder } from '../models/PurchaseOrder';
import * as poService from '../services/purchaseOrderService';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthedRequest } from '../types';

const lineSchema = z.object({
  productId: z.string().min(1),
  orderedQty: z.number().positive(),
  unitCost: z.number().min(0),
});

const createPOSchema = z.object({
  poNumber: z.string().min(1),
  supplierName: z.string().min(1),
  warehouseId: z.string().min(1),
  lines: z.array(lineSchema).min(1),
});

const receiveSchema = z.object({
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().positive(),
        lotNumber: z.string().optional(),
        expiryDate: z.coerce.date().optional(),
      })
    )
    .min(1),
});

export const listPurchaseOrders = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { status, warehouseId } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (warehouseId) filter.warehouseId = warehouseId;

  const orders = await PurchaseOrder.find(filter).sort({ createdAt: -1 });
  res.json({ orders });
});

export const getPurchaseOrder = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) return res.status(404).json({ error: 'Purchase order not found' });
  res.json({ purchaseOrder: po });
});

export const createPurchaseOrder = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const body = createPOSchema.parse(req.body);
  const po = await poService.createPurchaseOrder({ ...body, createdBy: req.user!.userId });
  res.status(201).json({ purchaseOrder: po });
});

export const markOrdered = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const po = await poService.markOrdered(req.params.id as string);
  res.json({ purchaseOrder: po });
});

export const receivePurchaseOrder = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const body = receiveSchema.parse(req.body);
  const po = await poService.receivePurchaseOrder(req.params.id as string, body.lines, req.user!.userId);
  res.json({ purchaseOrder: po });
});
