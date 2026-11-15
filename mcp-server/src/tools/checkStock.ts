import { z } from 'zod';
import { apiFetch } from '../apiClient.js';
import { resolveProductBySku, resolveWarehouseByName } from '../resolvers.js';
import { runTool } from '../toolHelpers.js';
import type { StockQuantityResponse, WarehouseListResponse } from '../types.js';

export const checkStockShape = {
  sku: z.string().describe('The product SKU to look up, e.g. "SKU-0012"'),
  warehouseName: z
    .string()
    .optional()
    .describe('Limit the check to one warehouse by name. Omit to see stock across every warehouse.'),
};

const inputSchema = z.object(checkStockShape);

export async function checkStock(rawInput: unknown) {
  return runTool(async () => {
    const input = inputSchema.parse(rawInput);
    const product = await resolveProductBySku(input.sku);

    const targetWarehouses = input.warehouseName
      ? [await resolveWarehouseByName(input.warehouseName)]
      : (await apiFetch<WarehouseListResponse>('/warehouses')).warehouses;

    if (targetWarehouses.length === 0) {
      return `${product.name} (${product.sku}) — no warehouses exist to check stock in.`;
    }

    const lines = await Promise.all(
      targetWarehouses.map(async (w) => {
        const stock = await apiFetch<StockQuantityResponse>(`/stock/${product._id}/${w._id}`);
        return `  ${w.name}: ${stock.quantity} ${product.unit}`;
      })
    );

    const reorderNote =
      product.reorderPoint > 0
        ? ` (reorder point: ${product.reorderPoint} ${product.unit})`
        : ' (no reorder point set)';

    return `${product.name} (${product.sku})${reorderNote}\n${lines.join('\n')}`;
  });
}
