import { Schema, model, Document, Types } from 'mongoose';
import { PO_STATUSES, POStatus } from '../types';

export interface IPurchaseOrderLine {
  productId: Types.ObjectId;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
}

export interface IPurchaseOrder extends Document {
  _id: Types.ObjectId;
  poNumber: string;
  supplierName: string;
  warehouseId: Types.ObjectId;
  status: POStatus;
  lines: IPurchaseOrderLine[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lineSchema = new Schema<IPurchaseOrderLine>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    orderedQty: { type: Number, required: true, min: 0.0001 },
    receivedQty: { type: Number, required: true, default: 0, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    poNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    supplierName: { type: String, required: true, trim: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    status: { type: String, enum: PO_STATUSES, default: 'draft' },
    lines: { type: [lineSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const PurchaseOrder = model<IPurchaseOrder>('PurchaseOrder', purchaseOrderSchema);
