/**
 * Manual sanity check for apiClient.ts, run against a throwaway local
 * HTTP server rather than the real API — so it works with zero setup
 * (no Mongo, no running API, no .env needed) and still proves the actual
 * networking code: the Bearer header goes out correctly, bodies round-trip,
 * and API error responses map to ApiClientError with the real message
 * preserved. Not a replacement for testing against the real API once it's
 * running — just the fastest way to catch a broken request/response
 * shape before wiring up real tools.
 *
 * Run with: npm run verify
 */
import http from 'node:http';
import { apiFetch, ApiClientError } from './apiClient.js';

async function main() {
  let receivedAuthHeader: string | undefined;

  const server = http.createServer((req, res) => {
    receivedAuthHeader = req.headers.authorization;

    if (req.url === '/warehouses' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ warehouses: [{ _id: '1', name: 'Test Warehouse' }] }));
      return;
    }
    if (req.url === '/nope' && req.method === 'GET') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found on purpose' }));
      return;
    }
    if (req.url === '/echo' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ receivedBody: JSON.parse(body) }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (typeof address !== 'object' || address === null) throw new Error('no port');
  const port = address.port;

  process.env.API_BASE_URL = `http://localhost:${port}`;
  process.env.MCP_SERVICE_TOKEN = 'test-token-abc123';

  let failures = 0;
  function check(label: string, cond: boolean) {
    if (cond) {
      console.log(`  ok  - ${label}`);
    } else {
      console.log(`  FAIL - ${label}`);
      failures++;
    }
  }

  // 1. Successful GET, and confirm the Bearer header actually went out on the wire
  const warehouses = await apiFetch<{ warehouses: { _id: string; name: string }[] }>('/warehouses');
  check('GET /warehouses returns parsed JSON', warehouses.warehouses[0]?.name === 'Test Warehouse');
  check('Authorization header was sent as Bearer <token>', receivedAuthHeader === 'Bearer test-token-abc123');

  // 2. POST with a body round-trips correctly
  const echoed = await apiFetch<{ receivedBody: { hello: string } }>('/echo', {
    method: 'POST',
    body: { hello: 'world' },
  });
  check('POST body is sent and parsed correctly', echoed.receivedBody.hello === 'world');

  // 3. Error responses map to ApiClientError with the API's real error message, not a generic one
  try {
    await apiFetch('/nope');
    check('404 should have thrown', false);
  } catch (err) {
    const isApiClientError = err instanceof ApiClientError;
    check('404 throws ApiClientError', isApiClientError);
    check(
      '404 error message comes from the API body, not generic',
      isApiClientError && (err as ApiClientError).message === 'Not found on purpose'
    );
    check('404 status is preserved on the error', isApiClientError && (err as ApiClientError).status === 404);
  }

  server.close();

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll apiClient checks passed against a real HTTP round trip.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
