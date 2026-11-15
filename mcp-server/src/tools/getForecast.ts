import { z } from 'zod';
import { apiFetch } from '../apiClient.js';
import { resolveProductBySku, resolveWarehouseByName } from '../resolvers.js';
import { runTool } from '../toolHelpers.js';
import type { ForecastResponse, Warehouse, WarehouseListResponse } from '../types.js';

export const getForecastShape = {
  sku: z.string().describe('The product SKU to forecast, e.g. "SKU-0012"'),
  warehouseName: z
    .string()
    .optional()
    .describe('Limit the forecast to one warehouse by name. Omit to see every warehouse.'),
};

const inputSchema = z.object(getForecastShape);

export async function getForecast(rawInput: unknown) {
  return runTool(async () => {
    const input = inputSchema.parse(rawInput);
    const product = await resolveProductBySku(input.sku);

    let warehouseNameById: Map<string, string>;
    let query: Record<string, string | undefined> = {};

    if (input.warehouseName) {
      const w = await resolveWarehouseByName(input.warehouseName);
      warehouseNameById = new Map([[w._id, w.name]]);
      query = { warehouseId: w._id };
    } else {
      const all = (await apiFetch<WarehouseListResponse>('/warehouses')).warehouses;
      warehouseNameById = new Map(all.map((w: Warehouse) => [w._id, w.name]));
    }

    const res = await apiFetch<ForecastResponse>(`/forecast/${product._id}`, { query });

    if (res.forecasts.length === 0) {
      return `No forecast data for ${product.name} (${product.sku}).`;
    }

    const lines = res.forecasts.map((f) => {
      const warehouseName = warehouseNameById.get(f.warehouseId) ?? f.warehouseId;
      const flag = f.reorderSuggested ? ' ⚠ REORDER SUGGESTED' : '';
      return `${warehouseName}:${flag}\n  ${f.reason}`;
    });

    return `Forecast for ${product.name} (${product.sku}):\n\n${lines.join('\n\n')}`;
  });
}
