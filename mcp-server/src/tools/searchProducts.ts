import { z } from 'zod';
import { apiFetch } from '../apiClient.js';
import { runTool } from '../toolHelpers.js';
import type { ProductListResponse } from '../types.js';

export const searchProductsShape = {
  query: z.string().describe('Text to search for in product name or SKU'),
};

const inputSchema = z.object(searchProductsShape);

export async function searchProducts(rawInput: unknown) {
  return runTool(async () => {
    const input = inputSchema.parse(rawInput);
    const res = await apiFetch<ProductListResponse>('/products', {
      query: { search: input.query, limit: '10' },
    });

    if (res.items.length === 0) {
      return `No products match "${input.query}".`;
    }

    const lines = res.items.map(
      (p) => `${p.sku} — ${p.name}${p.category ? ` (${p.category})` : ''} — cost ₹${p.costPrice}, sell ₹${p.sellPrice}`
    );
    const more = res.total > res.items.length ? `\n(${res.total - res.items.length} more not shown)` : '';
    return `${res.items.length} of ${res.total} matching products:\n${lines.join('\n')}${more}`;
  });
}
