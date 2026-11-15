import { Response } from 'express';
import { z } from 'zod';
import { SalesOrder } from '../models/SalesOrder';
import * as soService from '../services/salesOrderService';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthedRequest } from '../types';

const lineSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().positive(),
  unitPrice: z.number().min(0),
});

const createSOSchema = z.object({
  orderNumber: z.string().min(1),
  warehouseId: z.string().min(1),
  lines: z.array(lineSchema).min(1),
});

const fulfillSchema = z.object({
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().positive(),
      })
    )
    .min(1),
});

export const listSalesOrders = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { status, warehouseId } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (warehouseId) filter.warehouseId = warehouseId;

  const orders = await SalesOrder.find(filter).sort({ createdAt: -1 });
  res.json({ orders });
});

export const getSalesOrder = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const so = await SalesOrder.findById(req.params.id);
  if (!so) return res.status(404).json({ error: 'Sales order not found' });
  res.json({ salesOrder: so });
});

export const createSalesOrder = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const body = createSOSchema.parse(req.body);
  const so = await soService.createSalesOrder({ ...body, createdBy: req.user!.userId });
  res.status(201).json({ salesOrder: so });
});

export const fulfillSalesOrder = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const body = fulfillSchema.parse(req.body);
  const so = await soService.fulfillSalesOrder(req.params.id as string, body.lines, req.user!.userId);
  res.json({ salesOrder: so });
});

export const cancelSalesOrder = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const so = await soService.cancelSalesOrder(req.params.id as string);
  res.json({ salesOrder: so });
});
