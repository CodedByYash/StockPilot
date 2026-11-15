import { Response } from 'express';
import { z } from 'zod';
import { Warehouse } from '../models/Warehouse';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthedRequest } from '../types';

const warehouseSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
});

export const listWarehouses = asyncHandler(async (_req: AuthedRequest, res: Response) => {
  const warehouses = await Warehouse.find({ isActive: true }).sort({ name: 1 });
  res.json({ warehouses });
});

export const createWarehouse = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const body = warehouseSchema.parse(req.body);
  const warehouse = await Warehouse.create(body);
  res.status(201).json({ warehouse });
});

export const updateWarehouse = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const body = warehouseSchema.partial().parse(req.body);
  const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });
  res.json({ warehouse });
});

export const deactivateWarehouse = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });
  res.status(204).send();
});
