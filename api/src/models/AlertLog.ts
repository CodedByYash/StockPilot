import { Schema, model, Document, Types } from 'mongoose';

export const ALERT_TYPES = ['low_stock', 'reorder_suggested'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export interface IAlertLog extends Document {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  type: AlertType;
  message: string;
  resolved: boolean;
  createdAt: Date;
}

const alertLogSchema = new Schema<IAlertLog>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    type: { type: String, enum: ALERT_TYPES, required: true },
    message: { type: String, required: true },
    resolved: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Used by the alert-generation job to check "is there already an open
// alert of this type for this product+warehouse" before creating another,
// so a low-stock item doesn't spam a new alert every time the job runs.
alertLogSchema.index({ productId: 1, warehouseId: 1, type: 1, resolved: 1 });

export const AlertLog = model<IAlertLog>('AlertLog', alertLogSchema);
