import { apiFetch } from './apiClient.js';
import type {
  Product,
  ProductListResponse,
  PurchaseOrder,
  PurchaseOrderListResponse,
  Warehouse,
  WarehouseListResponse,
} from './types.js';

export class ResolverNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResolverNotFoundError';
  }
}

/**
 * Resolves a SKU (what a person or an AI assistant naturally refers to a
 * product by) to the full product, including its Mongo _id (what the API
 * actually needs). No tool should ever require an ObjectId as input.
 *
 * Implementation note / known limitation: there's no dedicated
 * "GET /products/by-sku/:sku" endpoint on the API, so this goes through
 * the existing search endpoint (`GET /products?search=`) and then filters
 * for an exact, case-insensitive SKU match among the results. That's fine
 * at the scale this project's seed data and portfolio use represent (tens
 * of products), but it's not how you'd want this to work against a real
 * catalog of thousands of SKUs — search relevance ranking could push an
 * exact match off the first page. The honest fix, if this ever needs to
 * scale, is a real `GET /products/by-sku/:sku` endpoint on the API doing
 * an indexed exact-match query; not built here to avoid backend scope
 * creep in what's meant to be the MCP layer's work.
 */
export async function resolveProductBySku(sku: string): Promise<Product> {
  const target = sku.trim().toUpperCase();
  const res = await apiFetch<ProductListResponse>('/products', {
    query: { search: target, limit: '25' },
  });

  const exact = res.items.find((p) => p.sku.toUpperCase() === target);
  if (exact) return exact;

  if (res.items.length > 0) {
    const suggestions = res.items.slice(0, 5).map((p) => p.sku).join(', ');
    throw new ResolverNotFoundError(
      `No product with SKU "${sku}" — closest matches: ${suggestions}`
    );
  }
  throw new ResolverNotFoundError(`No product found with SKU "${sku}".`);
}

/**
 * Resolves a warehouse by name (case-insensitive). GET /warehouses returns
 * every active warehouse unpaginated, so unlike the SKU resolver above,
 * this one is a clean exact-match lookup with no scale caveat — warehouse
 * counts are small (single digits to low tens) even for a large operation.
 */
export async function resolveWarehouseByName(name: string): Promise<Warehouse> {
  const target = name.trim().toLowerCase();
  const res = await apiFetch<WarehouseListResponse>('/warehouses');

  const exact = res.warehouses.find((w) => w.name.trim().toLowerCase() === target);
  if (exact) return exact;

  if (res.warehouses.length > 0) {
    const available = res.warehouses.map((w) => w.name).join(', ');
    throw new ResolverNotFoundError(
      `No warehouse named "${name}" — available warehouses: ${available}`
    );
  }
  throw new ResolverNotFoundError(`No warehouse named "${name}" (no warehouses exist yet).`);
}

/**
 * Resolves a PO number to the full purchase order. Like the SKU resolver,
 * there's no dedicated "GET /purchase-orders/by-number/:poNumber" endpoint,
 * so this fetches the (unpaginated) list and filters for an exact,
 * case-insensitive match — fine at this project's scale, same honest
 * caveat as resolveProductBySku if the PO list ever grows very large.
 */
export async function resolvePurchaseOrderByNumber(poNumber: string): Promise<PurchaseOrder> {
  const target = poNumber.trim().toUpperCase();
  const res = await apiFetch<PurchaseOrderListResponse>('/purchase-orders');

  const exact = res.orders.find((po) => po.poNumber.toUpperCase() === target);
  if (exact) return exact;

  if (res.orders.length > 0) {
    const recent = res.orders.slice(0, 5).map((po) => po.poNumber).join(', ');
    throw new ResolverNotFoundError(`No purchase order "${poNumber}" — most recent POs: ${recent}`);
  }
  throw new ResolverNotFoundError(`No purchase order "${poNumber}" (no purchase orders exist yet).`);
}
