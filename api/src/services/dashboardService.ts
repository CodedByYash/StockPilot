import { Types } from 'mongoose';
import { ProductStock } from '../models/ProductStock';
import { StockMovement } from '../models/StockMovement';
import { AlertLog } from '../models/AlertLog';

export interface TopMoverRow {
  productId: Types.ObjectId;
  productName: string;
  sku: string;
  totalOutbound: number;
}

export interface DashboardSummary {
  totalStockValue: number;
  totalUnits: number;
  lowStockOpenAlerts: number;
  topMovers: TopMoverRow[];
  recentActivity: unknown[];
}

const DEFAULT_WAREHOUSE_MATCH = (warehouseId?: string) =>
  warehouseId ? { warehouseId: new Types.ObjectId(warehouseId) } : {};

export async function getStockValueAndUnits(warehouseId?: string) {
  const match = DEFAULT_WAREHOUSE_MATCH(warehouseId);

  const [result] = await ProductStock.aggregate([
    { $match: match },
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
    {
      $group: {
        _id: null,
        totalStockValue: { $sum: { $multiply: ['$quantity', '$product.costPrice'] } },
        totalUnits: { $sum: '$quantity' },
      },
    },
  ]);

  return {
    totalStockValue: result?.totalStockValue ?? 0,
    totalUnits: result?.totalUnits ?? 0,
  };
}

/** Top-selling products by outbound quantity over the last N days. */
export async function getTopMovers(days = 30, limit = 5, warehouseId?: string): Promise<TopMoverRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const match: Record<string, unknown> = {
    type: 'outbound',
    createdAt: { $gte: since },
    ...DEFAULT_WAREHOUSE_MATCH(warehouseId),
  };

  const rows = await StockMovement.aggregate([
    { $match: match },
    { $group: { _id: '$productId', totalOutbound: { $sum: '$quantity' } } },
    { $sort: { totalOutbound: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        productName: '$product.name',
        sku: '$product.sku',
        totalOutbound: 1,
      },
    },
  ]);

  return rows as TopMoverRow[];
}

export async function getRecentActivity(limit = 20, warehouseId?: string) {
  const filter = DEFAULT_WAREHOUSE_MATCH(warehouseId);
  return StockMovement.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('productId', 'name sku')
    .populate('warehouseId', 'name')
    .lean();
}

export async function getDashboardSummary(warehouseId?: string): Promise<DashboardSummary> {
  const [{ totalStockValue, totalUnits }, lowStockOpenAlerts, topMovers, recentActivity] = await Promise.all([
    getStockValueAndUnits(warehouseId),
    AlertLog.countDocuments({
      type: 'low_stock',
      resolved: false,
      ...DEFAULT_WAREHOUSE_MATCH(warehouseId),
    }),
    getTopMovers(30, 5, warehouseId),
    getRecentActivity(20, warehouseId),
  ]);

  return { totalStockValue, totalUnits, lowStockOpenAlerts, topMovers, recentActivity };
}
