import { z } from 'zod';
import { apiFetch } from '../apiClient.js';
import { resolveProductBySku, resolvePurchaseOrderByNumber } from '../resolvers.js';
import { runTool } from '../toolHelpers.js';
import type { PurchaseOrderResponse } from '../types.js';

export const receivePurchaseOrderShape = {
  poNumber: z.string().describe('The purchase order number to receive stock against'),
  lines: z
    .array(
      z.object({
        sku: z.string().describe('Product SKU'),
        qty: z.number().positive().describe('Quantity actually received now — can be less than what was ordered'),
      })
    )
    .min(1)
    .describe('One or more lines being received. Receiving less than ordered leaves the order partially received.'),
};

const inputSchema = z.object(receivePurchaseOrderShape);

export async function receivePurchaseOrder(rawInput: unknown) {
  return runTool(async () => {
    const input = inputSchema.parse(rawInput);

    const po = await resolvePurchaseOrderByNumber(input.poNumber);
    const resolvedLines = await Promise.all(
      input.lines.map(async (line) => ({
        product: await resolveProductBySku(line.sku),
        qty: line.qty,
      }))
    );

    const res = await apiFetch<PurchaseOrderResponse>(`/purchase-orders/${po._id}/receive`, {
      method: 'PATCH',
      body: {
        lines: resolvedLines.map((l) => ({ productId: l.product._id, qty: l.qty })),
      },
    });

    // Report only on the lines involved in this call — not every line on
    // the PO, since the other lines weren't touched here and we only
    // resolved SKUs for the ones that were.
    const updatedLineByProductId = new Map(res.purchaseOrder.lines.map((l) => [l.productId, l]));
    const lineSummary = resolvedLines
      .map((l) => {
        const updated = updatedLineByProductId.get(l.product._id);
        return `  ${l.product.sku} — ${l.product.name}: ${updated?.receivedQty ?? '?'} / ${updated?.orderedQty ?? '?'} received`;
      })
      .join('\n');

    return `Received against ${po.poNumber} — order status is now: ${res.purchaseOrder.status}\n\n${lineSummary}`;
  });
}
