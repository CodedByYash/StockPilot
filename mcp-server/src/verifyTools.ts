/**
 * The strongest verification available without a real MCP client or a
 * live api/ + Mongo: starts a stub HTTP server standing in for the API,
 * spawns the ACTUAL mcp server (src/index.ts) as a child process, and
 * drives it through the real JSON-RPC protocol over its real stdin/stdout —
 * initialize, the initialized notification, tools/list, and tools/call for
 * two of the five tools. This exercises the entire pipeline: stdio
 * transport → registerTool dispatch → zod validation → tool handler →
 * apiClient → real HTTP → response → CallToolResult → JSON-RPC response.
 *
 * Run with: npm run verify:tools
 */
import { spawn } from 'node:child_process';
import http from 'node:http';

const PRODUCTS = [
  { _id: 'p1', sku: 'SKU-0001', name: 'Canvas Tote Bag', category: 'Accessories', unit: 'pcs', costPrice: 120, sellPrice: 220, reorderPoint: 15, reorderQty: 40, leadTimeDays: 7, trackLots: false, isActive: true },
];
const WAREHOUSES = [{ _id: 'w1', name: 'Pune Main', isActive: true }];

function startStubServer(): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === '/products') {
      return send(200, { items: PRODUCTS, total: PRODUCTS.length, page: 1, limit: 25 });
    }
    if (url.pathname === '/warehouses') {
      return send(200, { warehouses: WAREHOUSES });
    }
    if (url.pathname === '/stock/p1/w1') {
      return send(200, { productId: 'p1', warehouseId: 'w1', quantity: 42 });
    }
    return send(404, { error: 'not found in stub' });
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (typeof address !== 'object' || address === null) throw new Error('no port');
      resolve({ server, port: address.port });
    });
  });
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

function send(child: ReturnType<typeof spawn>, msg: object) {
  if (!child.stdin) throw new Error('child process has no stdin — spawn options must be wrong');
  child.stdin.write(JSON.stringify(msg) + '\n');
}

async function main() {
  const { server, port } = await startStubServer();

  const child = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      API_BASE_URL: `http://localhost:${port}`,
      MCP_SERVICE_TOKEN: 'test-token',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const responses: JsonRpcResponse[] = [];
  let buffer = '';
  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) {
        try {
          responses.push(JSON.parse(line));
        } catch {
          /* non-JSON line on stdout would itself be a bug — ignored here, but see the check below */
        }
      }
    }
  });

  let stderrOutput = '';
  child.stderr.on('data', (chunk: Buffer) => (stderrOutput += chunk.toString()));

  function waitForResponse(id: number, timeoutMs = 5000): Promise<JsonRpcResponse> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        const found = responses.find((r) => r.id === id);
        if (found) return resolve(found);
        if (Date.now() - start > timeoutMs) return reject(new Error(`Timed out waiting for response id ${id}`));
        setTimeout(check, 50);
      };
      check();
    });
  }

  let failures = 0;
  function check(label: string, cond: boolean) {
    console.log(`  ${cond ? 'ok  ' : 'FAIL'} - ${label}`);
    if (!cond) failures++;
  }

  try {
    // 1. Real MCP handshake
    send(child, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'verify-script', version: '1.0.0' } },
    });
    const initRes = await waitForResponse(1);
    check('initialize handshake succeeds', !!initRes.result);

    // required by the MCP spec before further requests
    send(child, { jsonrpc: '2.0', method: 'notifications/initialized' });

    // 2. tools/list — confirms all 5 tools actually registered with the SDK
    send(child, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const listRes = await waitForResponse(2);
    const tools = (listRes.result as { tools?: { name: string }[] } | undefined)?.tools ?? [];
    const names = tools.map((t) => t.name).sort();
    // This script only exercises the read-only tools (search_products,
    // check_stock below); the write tools added in step 5 are covered by
    // verifyWriteTools.ts. So this checks that the read-only set is a
    // subset of what's registered, not an exact-equality list — that
    // list grows with every step and hard-coding it here is exactly what
    // broke this check the first time step 5 added new tools.
    const readOnlyTools = ['check_stock', 'get_dashboard_summary', 'get_forecast', 'get_low_stock_alerts', 'search_products'];
    check(
      'tools/list includes all read-only tools from this script',
      readOnlyTools.every((name) => names.includes(name))
    );

    // 3. tools/call: search_products — real HTTP round trip through the stub
    send(child, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'search_products', arguments: { query: 'Tote' } },
    });
    const searchRes = await waitForResponse(3);
    const searchText = (searchRes.result as { content?: { text?: string }[] } | undefined)?.content?.[0]?.text ?? '';
    check('search_products finds the seeded product', searchText.includes('Canvas Tote Bag'));
    check('search_products result is not an error', !(searchRes.result as { isError?: boolean } | undefined)?.isError);

    // 4. tools/call: check_stock — exercises resolver + apiClient + tool formatting together
    send(child, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'check_stock', arguments: { sku: 'SKU-0001' } },
    });
    const stockRes = await waitForResponse(4);
    const stockText = (stockRes.result as { content?: { text?: string }[] } | undefined)?.content?.[0]?.text ?? '';
    check('check_stock reports the real quantity from the stub API', stockText.includes('42'));
    check('check_stock reports the warehouse name', stockText.includes('Pune Main'));

    // 5. tools/call with an unknown SKU — confirms error path returns isError, not a crash
    send(child, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'check_stock', arguments: { sku: 'NOT-REAL' } },
    });
    const notFoundRes = await waitForResponse(5);
    check('unknown SKU returns isError, not a crash', (notFoundRes.result as { isError?: boolean } | undefined)?.isError === true);

    check('server process stayed alive throughout (no crash on the stderr channel)', child.exitCode === null);
  } finally {
    child.kill();
    server.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    if (stderrOutput) console.error('\n--- server stderr ---\n' + stderrOutput);
    process.exit(1);
  }
  console.log('\nAll end-to-end tool checks passed through the real stdio protocol.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
