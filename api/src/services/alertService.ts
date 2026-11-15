import { Types } from 'mongoose';
import { AlertLog, IAlertLog } from '../models/AlertLog';
import { ProductStock } from '../models/ProductStock';

interface LowStockRow {
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  quantity: number;
  reorderPoint: number;
  productName: string;
}

/**
 * Joins current stock against each product's reorderPoint. Only considers
 * products with reorderPoint > 0 — a product with reorderPoint left at the
 * default of 0 is treated as "not being tracked for alerts yet" rather than
 * "alert only when it hits exactly zero", which would be a confusing default.
 */
async function findLowStockRows(): Promise<LowStockRow[]> {
  const rows = await ProductStock.aggregate([
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    { $match: { 'product.isActive': true, 'product.reorderPoint': { $gt: 0 } } },
    {
      $project: {
        productId: 1,
        warehouseId: 1,
        quantity: 1,
        reorderPoint: '$product.reorderPoint',
        productName: '$product.name',
      },
    },
  ]);

  return rows as LowStockRow[];
}

/**
 * The core alert job. Meant to run on a schedule (see jobs/lowStockCheck.ts).
 * For every product+warehouse currently at or below its reorder point,
 * ensures exactly one open 'low_stock' alert exists (doesn't spam a new one
 * every run). For anything back above threshold, auto-resolves any open
 * alert for it, since it's no longer actionable.
 */
export async function runLowStockCheck(): Promise<{ created: number; resolved: number }> {
  const rows = await findLowStockRows();
  const lowKeySet = new Set(rows.map((r) => `${r.productId.toString()}:${r.warehouseId.toString()}`));

  let created = 0;
  for (const row of rows) {
    const existing = await AlertLog.findOne({
      productId: row.productId,
      warehouseId: row.warehouseId,
      type: 'low_stock',
      resolved: false,
    });
    if (existing) continue;

    await AlertLog.create({
      productId: row.productId,
      warehouseId: row.warehouseId,
      type: 'low_stock',
      message: `${row.productName} is at ${row.quantity} units, at or below its reorder point of ${row.reorderPoint}.`,
    });
    created++;
  }

  // Auto-resolve open alerts for anything that's no longer low
  const openAlerts = await AlertLog.find({ type: 'low_stock', resolved: false });
  let resolved = 0;
  for (const alert of openAlerts) {
    const key = `${alert.productId.toString()}:${alert.warehouseId.toString()}`;
    if (!lowKeySet.has(key)) {
      alert.resolved = true;
      await alert.save();
      resolved++;
    }
  }

  return { created, resolved };
}

export async function listAlerts(resolved?: boolean): Promise<IAlertLog[]> {
  const filter: Record<string, unknown> = {};
  if (resolved !== undefined) filter.resolved = resolved;
  return AlertLog.find(filter).sort({ createdAt: -1 });
}

export async function resolveAlert(alertId: string): Promise<IAlertLog | null> {
  return AlertLog.findByIdAndUpdate(alertId, { resolved: true }, { new: true });
}

// Exported for tests / manual invocation without pulling in the Product model there
export { findLowStockRows };
