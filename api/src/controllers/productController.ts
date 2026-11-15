import { Response } from 'express';
import { z } from 'zod';
import { Product, UNITS } from '../models/Product';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthedRequest } from '../types';

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: z.enum(UNITS).optional(),
  barcode: z.string().min(1).optional(),
  costPrice: z.number().min(0),
  sellPrice: z.number().min(0),
  images: z.array(z.string()).optional(),
  reorderPoint: z.number().min(0).optional(),
  reorderQty: z.number().min(0).optional(),
  leadTimeDays: z.number().min(0).optional(),
  trackLots: z.boolean().optional(),
});

export const listProducts = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { search, category, page = '1', limit = '25' } = req.query as Record<string, string>;

  const filter: Record<string, unknown> = { isActive: true };
  if (category) filter.category = category;
  if (search) filter.$text = { $search: search };

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Product.countDocuments(filter),
  ]);

  res.json({ items, total, page: pageNum, limit: limitNum });
});

export const getProduct = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

export const createProduct = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const body = productSchema.parse(req.body);
  const product = await Product.create(body);
  res.status(201).json({ product });
});

export const updateProduct = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const body = productSchema.partial().parse(req.body);
  const product = await Product.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

// Soft delete — keeps StockMovement history intact and referentially valid
export const deleteProduct = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.status(204).send();
});
