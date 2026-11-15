import { z } from 'zod';
import { apiFetch } from '../apiClient.js';
import { runTool } from '../toolHelpers.js';
import type { AlertListResponse } from '../types.js';

export const lowStockAlertsShape = {
  includeResolved: z
    .boolean()
    .optional()
    .describe('Include already-resolved alerts too. Defaults to false (open alerts only).'),
};

const inputSchema = z.object(lowStockAlertsShape);

export async function getLowStockAlerts(rawInput: unknown) {
  return runTool(async () => {
    const input = inputSchema.parse(rawInput);
    const res = await apiFetch<AlertListResponse>('/alerts', {
      query: input.includeResolved ? {} : { resolved: 'false' },
    });

    if (res.alerts.length === 0) {
      return input.includeResolved ? 'No alerts at all.' : 'No open alerts — everything is within threshold.';
    }

    const lines = res.alerts.map((a) => {
      const kind = a.type === 'low_stock' ? 'LOW STOCK' : 'REORDER SUGGESTED';
      const status = a.resolved ? '[resolved]' : '[open]';
      return `${status} ${kind}: ${a.message}`;
    });
    return lines.join('\n');
  });
}
