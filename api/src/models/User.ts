import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, Role } from '../types';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  warehouseAccess: Types.ObjectId[];
  isActive: boolean;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: 'staff' },
    warehouseAccess: [{ type: Schema.Types.ObjectId, ref: 'Warehouse' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

// Never leak the hash in JSON responses
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const { passwordHash: _passwordHash, ...rest } = ret;
    return rest;
  },
});

export const User = model<IUser>('User', userSchema);
