import { Types } from 'mongoose';
import { SalesOrder, ISalesOrder } from '../models/SalesOrder';
import { recordMovement, getCurrentStock, InsufficientStockError } from './stockService';
import { SalesOrderLineInput, FulfillLineInput } from '../types';

export class SalesOrderError extends Error {}

interface CreateSOInput {
  orderNumber: string;
  warehouseId: string;
  lines: SalesOrderLineInput[];
  createdBy: string;
}

export async function createSalesOrder(input: CreateSOInput): Promise<ISalesOrder> {
  if (input.lines.length === 0) {
    throw new SalesOrderError('A sales order needs at least one line');
  }

  return SalesOrder.create({
    orderNumber: input.orderNumber,
    warehouseId: input.warehouseId,
    status: 'pending',
    createdBy: input.createdBy,
    lines: input.lines.map((l) => ({
      productId: l.productId,
      qty: l.qty,
      fulfilledQty: 0,
      unitPrice: l.unitPrice,
    })),
  });
}

/**
 * Fulfills some or all lines of a sales order.
 *
 * DESIGN DECISION (worth revisiting if your requirements differ): this does
 * PARTIAL FULFILLMENT + implicit backorder, not all-or-nothing rejection.
 * For each requested line, it fulfills as much as current stock allows —
 * up to the requested qty — and leaves the rest outstanding on the order
 * (qty - fulfilledQty is the backordered amount, there's no separate field
 * for it, it's derived). A line with 0 stock available simply gets 0
 * fulfilled this round and stays 'pending' at the order level.
 *
 * If you'd rather hard-reject an order that can't be fully fulfilled,
 * swap this for a pre-check pass that throws before recording any movement.
 *
 * Race-safety note: we don't trust a stock read taken before the write.
 * We attempt the full requested quantity first; if recordMovement's own
 * transaction rejects it as insufficient (someone else grabbed stock
 * concurrently), we re-check current stock and retry once for whatever
 * is actually available. This bounds each line to at most two attempts
 * and never oversells, because the enforcement lives inside
 * recordMovement's transaction, not in this pre-check.
 */
export async function fulfillSalesOrder(
  soId: string,
  requestedLines: FulfillLineInput[],
  userId: string
): Promise<ISalesOrder> {
  const so = await SalesOrder.findById(soId);
  if (!so) throw new SalesOrderError('Sales order not found');
  if (so.status === 'fulfilled' || so.status === 'cancelled') {
    throw new SalesOrderError(`Cannot fulfill a '${so.status}' sales order`);
  }

  for (const req of requestedLines) {
    const line = so.lines.find((l) => l.productId.toString() === req.productId);
    if (!line) {
      throw new SalesOrderError(`Product ${req.productId} is not on this sales order`);
    }

    const remaining = line.qty - line.fulfilledQty;
    if (req.qty > remaining) {
      throw new SalesOrderError(
        `Cannot fulfill ${req.qty} of product ${req.productId}: only ${remaining} remaining on the order`
      );
    }
    if (req.qty <= 0) continue;

    let qtyToRecord = req.qty;
    let fulfilled = 0;

    try {
      await recordMovement({
        productId: line.productId,
        warehouseId: so.warehouseId,
        type: 'outbound',
        quantity: qtyToRecord,
        referenceType: 'salesOrder',
        referenceId: so._id,
        createdBy: new Types.ObjectId(userId),
      });
      fulfilled = qtyToRecord;
    } catch (err) {
      if (!(err instanceof InsufficientStockError)) throw err;

      // Not enough stock for the full request — fulfill whatever is
      // actually available right now, if anything.
      const available = await getCurrentStock(req.productId, so.warehouseId.toString());
      qtyToRecord = Math.min(available, remaining);

      if (qtyToRecord > 0) {
        await recordMovement({
          productId: line.productId,
          warehouseId: so.warehouseId,
          type: 'outbound',
          quantity: qtyToRecord,
          referenceType: 'salesOrder',
          referenceId: so._id,
          createdBy: new Types.ObjectId(userId),
        });
        fulfilled = qtyToRecord;
      }
      // else: zero stock available, this line stays fully backordered for now
    }

    line.fulfilledQty += fulfilled;
  }

  const fullyFulfilled = so.lines.every((l) => l.fulfilledQty >= l.qty);
  const anyFulfilled = so.lines.some((l) => l.fulfilledQty > 0);
  so.status = fullyFulfilled ? 'fulfilled' : anyFulfilled ? 'partially_fulfilled' : so.status;

  await so.save();
  return so;
}

export async function cancelSalesOrder(soId: string): Promise<ISalesOrder> {
  const so = await SalesOrder.findById(soId);
  if (!so) throw new SalesOrderError('Sales order not found');
  if (so.status === 'fulfilled') {
    throw new SalesOrderError('Cannot cancel a fully fulfilled order — issue a return/adjustment instead');
  }
  so.status = 'cancelled';
  await so.save();
  return so;
}
