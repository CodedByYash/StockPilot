import mongoose, { Types } from 'mongoose';
import { StockMovement } from '../models/StockMovement';
import { ProductStock } from '../models/ProductStock';
import { MovementType, RecordMovementInput } from '../types';

/**
 * Maps a movement type to its effect on quantity.
 * `quantity` on the movement document is always stored positive;
 * this map is the single place that decides sign.
 */
const DIRECTION: Record<MovementType, 1 | -1> = {
  inbound: 1,
  outbound: -1,
  adjustment: 1, // adjustments are modeled as their own signed pair when needed;
  // a "reduce stock" adjustment should be recorded as outbound with
  // referenceType 'manual' instead of a negative adjustment. Keeping
  // adjustment as +1 here and enforcing that convention at the call site
  // keeps `quantity` non-negative everywhere, which the schema also enforces.
  transfer: -1, // a transfer OUT of a warehouse; the transfer IN is a second
  // movement recorded against the destination warehouse by the caller.
};

export class InsufficientStockError extends Error {
  constructor(productId: string, warehouseId: string, available: number, requested: number) {
    super(
      `Insufficient stock for product ${productId} in warehouse ${warehouseId}: ` +
        `available ${available}, requested ${requested}`
    );
    this.name = 'InsufficientStockError';
  }
}

/**
 * Records a stock movement and atomically updates the derived ProductStock
 * cache. This is the ONLY function in the codebase allowed to write to
 * StockMovement or ProductStock. Controllers and other services must call
 * this rather than touching those models directly.
 *
 * Uses a MongoDB session/transaction so the ledger insert and the cache
 * update either both succeed or both roll back — this is what prevents
 * quantity drift under concurrent writes.
 */
export async function recordMovement(input: RecordMovementInput) {
  const productId = new Types.ObjectId(input.productId);
  const warehouseId = new Types.ObjectId(input.warehouseId);
  const createdBy = new Types.ObjectId(input.createdBy);
  const referenceId = input.referenceId ? new Types.ObjectId(input.referenceId) : undefined;

  if (input.quantity <= 0) {
    throw new Error('quantity must be positive');
  }

  const direction = DIRECTION[input.type];
  const delta = direction * input.quantity;

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      // Outbound-style movements must not push stock negative.
      if (delta < 0) {
        const current = await ProductStock.findOne(
          { productId, warehouseId },
          null,
          { session }
        );
        const available = current?.quantity ?? 0;
        if (available + delta < 0) {
          throw new InsufficientStockError(
            productId.toString(),
            warehouseId.toString(),
            available,
            input.quantity
          );
        }
      }

      const [movement] = await StockMovement.create(
        [
          {
            productId,
            warehouseId,
            type: input.type,
            quantity: input.quantity,
            referenceType: input.referenceType,
            referenceId,
            lotNumber: input.lotNumber,
            expiryDate: input.expiryDate,
            createdBy,
            createdAt: input.occurredAt ?? new Date(),
          },
        ],
        { session }
      );

      const updated = await ProductStock.findOneAndUpdate(
        { productId, warehouseId },
        {
          $inc: { quantity: delta },
          $set: { lastMovementAt: input.occurredAt ?? new Date() },
        },
        { upsert: true, new: true, session }
      );

      result = { movement, stock: updated };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

/** Current quantity for a product in a specific warehouse (0 if no record yet). */
export async function getCurrentStock(productId: string, warehouseId: string): Promise<number> {
  const doc = await ProductStock.findOne({
    productId: new Types.ObjectId(productId),
    warehouseId: new Types.ObjectId(warehouseId),
  });
  return doc?.quantity ?? 0;
}

/** Full movement history for a product, most recent first. */
export async function getMovementHistory(productId: string, warehouseId?: string, limit = 100) {
  const filter: Record<string, unknown> = { productId: new Types.ObjectId(productId) };
  if (warehouseId) filter.warehouseId = new Types.ObjectId(warehouseId);

  return StockMovement.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}
