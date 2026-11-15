/**
 * Manual sanity check for resolvers.ts, same approach as verifyApiClient.ts —
 * a throwaway local HTTP server standing in for the real API, so this
 * actually exercises the resolution logic (exact-match filtering,
 * case-insensitivity, not-found messaging) instead of just type-checking it.
 *
 * Run with: npm run verify:resolvers
 */
import http from 'node:http';
import { resolveProductBySku, resolveWarehouseByName, ResolverNotFoundError } from './resolvers.js';

const PRODUCTS = [
  { _id: 'p1', sku: 'SKU-0001', name: 'Widget A', costPrice: 10, sellPrice: 16, reorderPoint: 5, reorderQty: 20, leadTimeDays: 7, trackLots: false, isActive: true, unit: 'pcs' },
  { _id: 'p2', sku: 'SKU-0002', name: 'Widget B', costPrice: 20, sellPrice: 32, reorderPoint: 5, reorderQty: 20, leadTimeDays: 7, trackLots: false, isActive: true, unit: 'pcs' },
];

const WAREHOUSES = [
  { _id: 'w1', name: 'Pune Main', isActive: true },
  { _id: 'w2', name: 'Mumbai Hub', isActive: true },
];

async function main() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '', 'http://localhost');

    if (url.pathname === '/products') {
      const search = (url.searchParams.get('search') ?? '').toUpperCase();
      const items = PRODUCTS.filter((p) => p.sku.includes(search) || search === '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ items, total: items.length, page: 1, limit: 25 }));
      return;
    }
    if (url.pathname === '/warehouses') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ warehouses: WAREHOUSES }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (typeof address !== 'object' || address === null) throw new Error('no port');
  process.env.API_BASE_URL = `http://localhost:${address.port}`;
  process.env.MCP_SERVICE_TOKEN = 'test-token';

  let failures = 0;
  function check(label: string, cond: boolean) {
    console.log(`  ${cond ? 'ok  ' : 'FAIL'} - ${label}`);
    if (!cond) failures++;
  }

  // Product resolver: exact match, case-insensitive
  const p1 = await resolveProductBySku('sku-0001');
  check('resolveProductBySku matches case-insensitively', p1._id === 'p1');

  const p2 = await resolveProductBySku('SKU-0002');
  check('resolveProductBySku matches exact case', p2._id === 'p2');

  // Product resolver: not found, with suggestions since partial matches exist
  try {
    await resolveProductBySku('SKU-000');
    check('SKU-000 (ambiguous, no exact match) should have thrown', false);
  } catch (err) {
    check('throws ResolverNotFoundError for a near-miss SKU', err instanceof ResolverNotFoundError);
    check(
      'near-miss error suggests close matches',
      err instanceof ResolverNotFoundError && err.message.includes('SKU-0001')
    );
  }

  // Product resolver: not found, zero candidates at all
  try {
    await resolveProductBySku('TOTALLY-UNKNOWN');
    check('unknown SKU should have thrown', false);
  } catch (err) {
    check(
      'unknown SKU gives a clean not-found message with no suggestions',
      err instanceof ResolverNotFoundError && !err.message.includes('closest matches')
    );
  }

  // Warehouse resolver: exact match, case-insensitive, trims whitespace
  const w1 = await resolveWarehouseByName('  pune main  ');
  check('resolveWarehouseByName matches case-insensitively and trims', w1._id === 'w1');

  // Warehouse resolver: not found, lists available names
  try {
    await resolveWarehouseByName('Nagpur Depot');
    check('unknown warehouse should have thrown', false);
  } catch (err) {
    check('throws ResolverNotFoundError for unknown warehouse', err instanceof ResolverNotFoundError);
    check(
      'unknown warehouse error lists available warehouses',
      err instanceof ResolverNotFoundError &&
        err.message.includes('Pune Main') &&
        err.message.includes('Mumbai Hub')
    );
  }

  server.close();

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll resolver checks passed against a real HTTP round trip.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
