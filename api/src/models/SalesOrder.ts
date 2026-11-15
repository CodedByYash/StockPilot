import { Schema, model, Document, Types } from 'mongoose';
import { SO_STATUSES, SOStatus } from '../types';

export interface ISalesOrderLine {
  productId: Types.ObjectId;
  qty: number;
  fulfilledQty: number;
  unitPrice: number;
}

export interface ISalesOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string;
  warehouseId: Types.ObjectId;
  status: SOStatus;
  lines: ISalesOrderLine[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lineSchema = new Schema<ISalesOrderLine>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, required: true, min: 0.0001 },
    fulfilledQty: { type: Number, required: true, default: 0, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const salesOrderSchema = new Schema<ISalesOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    status: { type: String, enum: SO_STATUSES, default: 'pending' },
    lines: { type: [lineSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const SalesOrder = model<ISalesOrder>('SalesOrder', salesOrderSchema);
