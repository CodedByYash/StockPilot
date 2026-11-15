import { z } from 'zod';
import { apiFetch } from '../apiClient.js';
import { resolveProductBySku, resolveWarehouseByName } from '../resolvers.js';
import { runTool } from '../toolHelpers.js';
import type { PurchaseOrderResponse } from '../types.js';

export const createPurchaseOrderShape = {
  supplierName: z.string().describe('Name of the supplier for this order'),
  warehouseName: z.string().describe('Which warehouse this stock will be received into'),
  poNumber: z
    .string()
    .optional()
    .describe('Purchase order number. If omitted, one is auto-generated (e.g. "PO-1733500000000").'),
  lines: z
    .array(
      z.object({
        sku: z.string().describe('Product SKU'),
        orderedQty: z.number().positive().describe('Quantity being ordered'),
        unitCost: z.number().min(0).describe('Cost per unit from the supplier'),
      })
    )
    .min(1)
    .describe('One or more line items for this order'),
};

const inputSchema = z.object(createPurchaseOrderShape);

export async function createPurchaseOrder(rawInput: unknown) {
  return runTool(async () => {
    const input = inputSchema.parse(rawInput);

    const warehouse = await resolveWarehouseByName(input.warehouseName);
    // Resolve every SKU before creating anything — if one SKU is wrong,
    // fail the whole request rather than create a PO with only some of
    // the intended lines on it.
    const resolvedLines = await Promise.all(
      input.lines.map(async (line) => ({
        product: await resolveProductBySku(line.sku),
        orderedQty: line.orderedQty,
        unitCost: line.unitCost,
      }))
    );

    const poNumber = input.poNumber ?? `PO-${Date.now()}`;

    const res = await apiFetch<PurchaseOrderResponse>('/purchase-orders', {
      method: 'POST',
      body: {
        poNumber,
        supplierName: input.supplierName,
        warehouseId: warehouse._id,
        lines: resolvedLines.map((l) => ({
          productId: l.product._id,
          orderedQty: l.orderedQty,
          unitCost: l.unitCost,
        })),
      },
    });

    const lineSummary = resolvedLines
      .map((l) => `  ${l.product.sku} — ${l.product.name}: ${l.orderedQty} @ ₹${l.unitCost}`)
      .join('\n');

    return (
      `Created purchase order ${res.purchaseOrder.poNumber} (status: ${res.purchaseOrder.status})\n` +
      `Supplier: ${input.supplierName} · Warehouse: ${warehouse.name}\n\n${lineSummary}`
    );
  });
}
