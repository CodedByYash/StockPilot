import { Types } from 'mongoose';
import { Product, IProduct } from '../models/Product';
import { ProductStock } from '../models/ProductStock';
import { recordMovement } from './stockService';
import { MovementType, ReferenceType } from '../types';

export class BarcodeNotFoundError extends Error {
  constructor(barcode: string) {
    super(`No product found for barcode '${barcode}'`);
    this.name = 'BarcodeNotFoundError';
  }
}

async function findProductByBarcode(barcode: string): Promise<IProduct> {
  const product = await Product.findOne({ barcode, isActive: true });
  if (!product) throw new BarcodeNotFoundError(barcode);
  return product;
}

/**
 * The core "scan a code, see what it is" lookup. Returns the product plus
 * its current stock in every warehouse it exists in — this is what a
 * warehouse worker sees the instant they scan an item, before deciding
 * whether they're receiving, adjusting, or just checking.
 */
export async function lookupByBarcode(barcode: string) {
  const product = await findProductByBarcode(barcode);

  const stockRows = await ProductStock.find({ productId: product._id })
    .populate('warehouseId', 'name')
    .lean();

  return { product, stockByWarehouse: stockRows };
}

interface RecordByBarcodeInput {
  barcode: string;
  warehouseId: string;
  type: MovementType;
  quantity: number;
  referenceType?: ReferenceType;
  referenceId?: string;
  lotNumber?: string;
  createdBy: string;
}

/**
 * Scan-to-record: resolves the barcode to a product internally, then
 * delegates to stockService.recordMovement — same transactional guarantees,
 * same InsufficientStockError behavior, just without the client needing to
 * already know the product's Mongo ID. This is the endpoint a mobile
 * scanning flow actually calls when receiving a PO or doing a quick
 * manual adjustment in the aisle.
 */
export async function recordMovementByBarcode(input: RecordByBarcodeInput) {
  const product = await findProductByBarcode(input.barcode);

  return recordMovement({
    productId: product._id,
    warehouseId: new Types.ObjectId(input.warehouseId),
    type: input.type,
    quantity: input.quantity,
    referenceType: input.referenceType ?? 'manual',
    referenceId: input.referenceId ? new Types.ObjectId(input.referenceId) : undefined,
    lotNumber: input.lotNumber,
    createdBy: new Types.ObjectId(input.createdBy),
  });
}
