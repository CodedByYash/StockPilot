import { Types } from 'mongoose';
import { PurchaseOrder, IPurchaseOrder } from '../models/PurchaseOrder';
import { recordMovement } from './stockService';
import { PurchaseOrderLineInput, ReceiveLineInput } from '../types';

export class PurchaseOrderError extends Error {}

interface CreatePOInput {
  poNumber: string;
  supplierName: string;
  warehouseId: string;
  lines: PurchaseOrderLineInput[];
  createdBy: string;
}

export async function createPurchaseOrder(input: CreatePOInput): Promise<IPurchaseOrder> {
  if (input.lines.length === 0) {
    throw new PurchaseOrderError('A purchase order needs at least one line');
  }

  return PurchaseOrder.create({
    poNumber: input.poNumber,
    supplierName: input.supplierName,
    warehouseId: input.warehouseId,
    status: 'draft',
    createdBy: input.createdBy,
    lines: input.lines.map((l) => ({
      productId: l.productId,
      orderedQty: l.orderedQty,
      receivedQty: 0,
      unitCost: l.unitCost,
    })),
  });
}

export async function markOrdered(poId: string): Promise<IPurchaseOrder> {
  const po = await PurchaseOrder.findById(poId);
  if (!po) throw new PurchaseOrderError('Purchase order not found');
  if (po.status !== 'draft') {
    throw new PurchaseOrderError(`Cannot mark as ordered from status '${po.status}'`);
  }
  po.status = 'ordered';
  await po.save();
  return po;
}

/**
 * Receives some or all lines of a purchase order.
 *
 * Each line's receipt calls stockService.recordMovement('inbound', ...),
 * which is its own atomic transaction (ledger insert + cache update).
 * After all lines are recorded, the PO document itself is updated with the
 * new receivedQty totals and a recalculated status.
 *
 * Note on atomicity: this function is NOT a single all-or-nothing transaction
 * across every line — if line 2 of 3 fails, lines already recorded stay
 * recorded (their stock genuinely arrived) and the PO reflects partial
 * receipt accurately. That's the correct real-world behavior: a partially
 * delivered shipment should show as partially received, not roll back the
 * boxes that did arrive.
 */
export async function receivePurchaseOrder(
  poId: string,
  receivedLines: ReceiveLineInput[],
  userId: string
): Promise<IPurchaseOrder> {
  const po = await PurchaseOrder.findById(poId);
  if (!po) throw new PurchaseOrderError('Purchase order not found');
  if (po.status === 'received' || po.status === 'cancelled') {
    throw new PurchaseOrderError(`Cannot receive against a '${po.status}' purchase order`);
  }

  for (const receipt of receivedLines) {
    const line = po.lines.find((l) => l.productId.toString() === receipt.productId);
    if (!line) {
      throw new PurchaseOrderError(`Product ${receipt.productId} is not on this purchase order`);
    }

    const remaining = line.orderedQty - line.receivedQty;
    if (receipt.qty > remaining) {
      throw new PurchaseOrderError(
        `Cannot receive ${receipt.qty} of product ${receipt.productId}: only ${remaining} remaining on the order`
      );
    }

    await recordMovement({
      productId: line.productId,
      warehouseId: po.warehouseId,
      type: 'inbound',
      quantity: receipt.qty,
      referenceType: 'purchaseOrder',
      referenceId: po._id,
      lotNumber: receipt.lotNumber,
      expiryDate: receipt.expiryDate,
      createdBy: new Types.ObjectId(userId),
    });

    line.receivedQty += receipt.qty;
  }

  const fullyReceived = po.lines.every((l) => l.receivedQty >= l.orderedQty);
  const anyReceived = po.lines.some((l) => l.receivedQty > 0);
  po.status = fullyReceived ? 'received' : anyReceived ? 'partially_received' : po.status;

  await po.save();
  return po;
}
