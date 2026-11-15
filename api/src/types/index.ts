import { Request } from 'express';
import { Types } from 'mongoose';

// ---- Roles ----
export const ROLES = ['admin', 'manager', 'staff'] as const;
export type Role = (typeof ROLES)[number];

// ---- Stock movement kinds ----
// Declared with `as const` + a derived union type, NOT `string`.
// This is deliberate: without `as const` here, TS will happily widen
// this array to `string[]`, and every place that destructures a movement
// type ends up typed as `string` instead of the literal union — the same
// widening bug that bit the `variant` field before. Keep this pattern.
export const MOVEMENT_TYPES = ['inbound', 'outbound', 'adjustment', 'transfer'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const REFERENCE_TYPES = ['purchaseOrder', 'salesOrder', 'manual', 'transfer'] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

export const PO_STATUSES = ['draft', 'ordered', 'partially_received', 'received', 'cancelled'] as const;
export type POStatus = (typeof PO_STATUSES)[number];

export interface PurchaseOrderLineInput {
  productId: string;
  orderedQty: number;
  unitCost: number;
}

export interface ReceiveLineInput {
  productId: string;
  qty: number;
  lotNumber?: string;
  expiryDate?: Date;
}

export const SO_STATUSES = ['pending', 'partially_fulfilled', 'fulfilled', 'cancelled'] as const;
export type SOStatus = (typeof SO_STATUSES)[number];

export interface SalesOrderLineInput {
  productId: string;
  qty: number;
  unitPrice: number;
}

export interface FulfillLineInput {
  productId: string;
  qty: number;
}

// ---- Auth ----
export interface JwtPayload {
  userId: string;
  role: Role;
}

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

// ---- Service-layer DTO for recording a stock movement ----
// This is the single shape every caller (PO receiving, sales fulfillment,
// manual adjustment, transfers) must go through.
export interface RecordMovementInput {
  productId: Types.ObjectId | string;
  warehouseId: Types.ObjectId | string;
  type: MovementType;
  quantity: number; // always positive; direction is implied by `type`
  referenceType: ReferenceType;
  referenceId?: Types.ObjectId | string;
  lotNumber?: string;
  expiryDate?: Date;
  createdBy: Types.ObjectId | string;
  /**
   * Backdates the movement's timestamp. Only meant for seeding/importing
   * historical data (see scripts/seed.ts) — never accept this from a public
   * API request, since a real movement always happens "now". Defaults to
   * the actual current time when omitted, which is every normal code path.
   */
  occurredAt?: Date;
}
