import { Types } from 'mongoose';
import { StockMovement } from '../models/StockMovement';
import { ProductStock } from '../models/ProductStock';
import { Product } from '../models/Product';
import { AlertLog } from '../models/AlertLog';
import { getCurrentStock } from './stockService';

const VELOCITY_WINDOW_DAYS = 30;
const REORDER_BUFFER = 1.2; // suggest 20% more than bare minimum to absorb demand variance

export interface ForecastResult {
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  currentStock: number;
  dailyVelocity: number; // avg units sold/day over the lookback window
  daysOfStockRemaining: number | null; // null if velocity is 0 (no recent sales history)
  leadTimeDays: number;
  reorderSuggested: boolean;
  suggestedReorderQty: number;
  reason: string;
}

/**
 * Average daily outbound quantity for a product in a warehouse over the
 * last VELOCITY_WINDOW_DAYS. This is intentionally a plain moving average,
 * not a weighted/exponential one — simplest thing that's still honest
 * about recent demand. Swap the aggregation for exponential smoothing
 * later if the plain average proves too noisy for spiky SKUs.
 */
async function getDailyVelocity(productId: Types.ObjectId, warehouseId: Types.ObjectId): Promise<number> {
  const since = new Date(Date.now() - VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [result] = await StockMovement.aggregate([
    {
      $match: {
        productId,
        warehouseId,
        type: 'outbound',
        createdAt: { $gte: since },
      },
    },
    { $group: { _id: null, totalOutbound: { $sum: '$quantity' } } },
  ]);

  const totalOutbound = result?.totalOutbound ?? 0;
  return totalOutbound / VELOCITY_WINDOW_DAYS;
}

/** Full velocity-based forecast for one product in one warehouse. */
export async function getForecastForProduct(
  productId: string,
  warehouseId: string
): Promise<ForecastResult> {
  const pId = new Types.ObjectId(productId);
  const wId = new Types.ObjectId(warehouseId);

  const product = await Product.findById(pId);
  if (!product) throw new Error('Product not found');

  const [currentStock, dailyVelocity] = await Promise.all([
    getCurrentStock(productId, warehouseId),
    getDailyVelocity(pId, wId),
  ]);

  const leadTimeDays = product.leadTimeDays;

  if (dailyVelocity === 0) {
    return {
      productId: pId,
      warehouseId: wId,
      currentStock,
      dailyVelocity: 0,
      daysOfStockRemaining: null,
      leadTimeDays,
      reorderSuggested: false,
      suggestedReorderQty: 0,
      reason: `No outbound sales recorded for ${product.name} in the last ${VELOCITY_WINDOW_DAYS} days — not enough history to forecast.`,
    };
  }

  const daysOfStockRemaining = currentStock / dailyVelocity;
  const reorderSuggested = daysOfStockRemaining <= leadTimeDays;
  const suggestedReorderQty = Math.ceil(dailyVelocity * leadTimeDays * REORDER_BUFFER);

  const reason = reorderSuggested
    ? `${product.name} has about ${daysOfStockRemaining.toFixed(1)} days of stock left at a velocity of ` +
      `${dailyVelocity.toFixed(2)} units/day. Lead time is ${leadTimeDays} days, so it's due to run out ` +
      `before a new order would arrive — suggest reordering ~${suggestedReorderQty} units.`
    : `${product.name} has about ${daysOfStockRemaining.toFixed(1)} days of stock left at a velocity of ` +
      `${dailyVelocity.toFixed(2)} units/day, comfortably ahead of the ${leadTimeDays}-day lead time.`;

  return {
    productId: pId,
    warehouseId: wId,
    currentStock,
    dailyVelocity,
    daysOfStockRemaining,
    leadTimeDays,
    reorderSuggested,
    suggestedReorderQty,
    reason,
  };
}

/**
 * The nightly job. For every product+warehouse combination that currently
 * has stock on record, computes velocity and creates/dedupes a
 * 'reorder_suggested' AlertLog entry when it's due to run out before lead
 * time. Mirrors alertService.runLowStockCheck's create/dedupe/auto-resolve
 * pattern, just driven by velocity instead of a static threshold — the two
 * systems complement each other: reorderPoint catches sudden drops
 * regardless of history, this catches slow-bleed items before they ever
 * cross a manually-set threshold.
 */
export async function runReorderCheck(): Promise<{ created: number; resolved: number }> {
  const stockRows = await ProductStock.aggregate([
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    { $match: { 'product.isActive': true } },
    { $project: { productId: 1, warehouseId: 1 } },
  ]);

  let created = 0;
  const dueKeySet = new Set<string>();

  for (const row of stockRows) {
    const forecast = await getForecastForProduct(row.productId.toString(), row.warehouseId.toString());
    if (!forecast.reorderSuggested) continue;

    const key = `${row.productId.toString()}:${row.warehouseId.toString()}`;
    dueKeySet.add(key);

    const existing = await AlertLog.findOne({
      productId: row.productId,
      warehouseId: row.warehouseId,
      type: 'reorder_suggested',
      resolved: false,
    });
    if (existing) continue;

    await AlertLog.create({
      productId: row.productId,
      warehouseId: row.warehouseId,
      type: 'reorder_suggested',
      message: forecast.reason,
    });
    created++;
  }

  const openAlerts = await AlertLog.find({ type: 'reorder_suggested', resolved: false });
  let resolved = 0;
  for (const alert of openAlerts) {
    const key = `${alert.productId.toString()}:${alert.warehouseId.toString()}`;
    if (!dueKeySet.has(key)) {
      alert.resolved = true;
      await alert.save();
      resolved++;
    }
  }

  return { created, resolved };
}
