import { Schema, model, Document, Types } from 'mongoose';

/**
 * ProductStock is a DERIVED CACHE, not a source of truth.
 * It exists purely so we don't have to aggregate the entire StockMovement
 * ledger every time someone asks "how much stock is there right now".
 *
 * It is only ever written to inside stockService.recordMovement(), in the
 * same transaction as the StockMovement insert. If this collection is ever
 * wrong, it can be rebuilt by replaying StockMovement from scratch
 * (see scripts/rebuildStockCache.ts).
 */
export interface IProductStock extends Document {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  quantity: number;
  lastMovementAt: Date;
}

const productStockSchema = new Schema<IProductStock>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    quantity: { type: Number, required: true, default: 0 },
    lastMovementAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One stock row per product+warehouse combination
productStockSchema.index({ productId: 1, warehouseId: 1 }, { unique: true });

export const ProductStock = model<IProductStock>('ProductStock', productStockSchema);
