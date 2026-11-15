import { Schema, model, Document, Types } from 'mongoose';

export interface IWarehouse extends Document {
  _id: Types.ObjectId;
  name: string;
  address?: string;
  isActive: boolean;
}

const warehouseSchema = new Schema<IWarehouse>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    address: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Warehouse = model<IWarehouse>('Warehouse', warehouseSchema);
