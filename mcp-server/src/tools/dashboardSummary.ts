import { z } from 'zod';
import { apiFetch } from '../apiClient.js';
import { resolveWarehouseByName } from '../resolvers.js';
import { runTool } from '../toolHelpers.js';
import type { DashboardSummary } from '../types.js';

export const dashboardSummaryShape = {
  warehouseName: z
    .string()
    .optional()
    .describe('Scope the summary to one warehouse by name. Omit for the whole business.'),
};

const inputSchema = z.object(dashboardSummaryShape);

export async function getDashboardSummary(rawInput: unknown) {
  return runTool(async () => {
    const input = inputSchema.parse(rawInput);
    const query: Record<string, string | undefined> = {};

    if (input.warehouseName) {
      const w = await resolveWarehouseByName(input.warehouseName);
      query.warehouseId = w._id;
    }

    const summary = await apiFetch<DashboardSummary>('/dashboard/summary', { query });

    const scope = input.warehouseName ? ` for ${input.warehouseName}` : '';
    const movers = summary.topMovers.length
      ? summary.topMovers.map((m) => `  ${m.productName} (${m.sku}) — ${m.totalOutbound} units sold, last 30 days`).join('\n')
      : '  (no sales activity in the last 30 days)';

    return (
      `Dashboard summary${scope}:\n` +
      `  Stock value: ₹${summary.totalStockValue.toLocaleString('en-IN')}\n` +
      `  Total units on hand: ${summary.totalUnits}\n` +
      `  Open low-stock alerts: ${summary.lowStockOpenAlerts}\n\n` +
      `Top movers (last 30 days):\n${movers}`
    );
  });
}
