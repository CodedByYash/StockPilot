import { Schema, model, Document, Types } from 'mongoose';

export const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'box', 'pair'] as const;
export type Unit = (typeof UNITS)[number];

export interface IProduct extends Document {
  _id: Types.ObjectId;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: Unit;
  barcode?: string;
  costPrice: number;
  sellPrice: number;
  images: string[];
  reorderPoint: number; // manual fallback threshold, used until velocity data exists
  reorderQty: number;
  leadTimeDays: number; // expected days from placing a PO to receiving stock; drives the velocity-based reorder suggestion
  trackLots: boolean;
  isActive: boolean;
}

const productSchema = new Schema<IProduct>(
  {
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true, index: true },
    unit: { type: String, enum: UNITS, default: 'pcs' },
    barcode: { type: String, trim: true },
    costPrice: { type: Number, required: true, min: 0 },
    sellPrice: { type: Number, required: true, min: 0 },
    images: [{ type: String }],
    reorderPoint: { type: Number, default: 0, min: 0 },
    reorderQty: { type: Number, default: 0, min: 0 },
    leadTimeDays: { type: Number, default: 7, min: 0 },
    trackLots: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', sku: 'text' });
// sparse: not every product has a barcode assigned yet, but any that do
// must be unique — this is what makes barcode→product lookup unambiguous.
productSchema.index({ barcode: 1 }, { unique: true, sparse: true });

export const Product = model<IProduct>('Product', productSchema);
