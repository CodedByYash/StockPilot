import { z } from 'zod';
import { apiFetch } from '../apiClient.js';
import { resolveWarehouseByName } from '../resolvers.js';
import { runTool } from '../toolHelpers.js';
import type { RecordMovementResponse } from '../types.js';

export const recordStockMovementShape = {
  barcode: z.string().describe('The product barcode to record a movement for'),
  warehouseName: z.string().describe('Which warehouse this movement applies to'),
  type: z
    .enum(['inbound', 'outbound', 'adjustment'])
    .describe(
      'inbound = stock arriving (receiving, found inventory); outbound = stock leaving (shipped, damaged, lost); adjustment = correcting a count upward. ' +
        'Transfers between warehouses aren\u2019t supported by this tool — use two separate movements if needed.'
    ),
  quantity: z.number().positive().describe('How many units'),
};

const inputSchema = z.object(recordStockMovementShape);

export async function recordStockMovement(rawInput: unknown) {
  return runTool(async () => {
    const input = inputSchema.parse(rawInput);
    const warehouse = await resolveWarehouseByName(input.warehouseName);

    const res = await apiFetch<RecordMovementResponse>('/barcode/movements', {
      method: 'POST',
      body: {
        barcode: input.barcode,
        warehouseId: warehouse._id,
        type: input.type,
        quantity: input.quantity,
      },
    });

    return (
      `Recorded ${input.type} of ${input.quantity} unit(s) for barcode ${input.barcode} in ${warehouse.name}.\n` +
      `New quantity on hand: ${res.stock.quantity}`
    );
  });
}
