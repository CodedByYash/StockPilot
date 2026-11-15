import { Schema, model, Document, Types } from 'mongoose';
import { MOVEMENT_TYPES, MovementType, REFERENCE_TYPES, ReferenceType } from '../types';

/**
 * StockMovement is the SOURCE OF TRUTH for stock levels.
 *
 * Rules that must never be broken:
 *  1. Documents in this collection are never updated or deleted after creation.
 *     Corrections happen by inserting a new offsetting movement (type: 'adjustment'),
 *     never by editing history.
 *  2. `quantity` is always a positive number. Direction (does it add or remove
 *     stock) is implied entirely by `type` — see stockService.ts for the mapping.
 *  3. The ONLY code path allowed to insert into this collection is
 *     stockService.recordMovement(). Do not import this model directly into
 *     controllers.
 */
export interface IStockMovement extends Document {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  type: MovementType;
  quantity: number;
  referenceType: ReferenceType;
  referenceId?: Types.ObjectId;
  lotNumber?: string;
  expiryDate?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    quantity: { type: Number, required: true, min: 0.0001 },
    referenceType: { type: String, enum: REFERENCE_TYPES, required: true },
    referenceId: { type: Schema.Types.ObjectId },
    lotNumber: { type: String, trim: true },
    expiryDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Fast lookups for a product's movement history and per-warehouse queries
stockMovementSchema.index({ productId: 1, warehouseId: 1, createdAt: -1 });

export const StockMovement = model<IStockMovement>('StockMovement', stockMovementSchema);
