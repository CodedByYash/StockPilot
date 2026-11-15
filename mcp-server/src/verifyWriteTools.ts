/**
 * Same approach as verifyTools.ts: a stub HTTP API + the REAL mcp server
 * spawned as a child process, driven through real JSON-RPC. This one
 * focuses on the write tools, including the case that matters most for
 * them — a real business-rule error from the API (over-receiving a PO
 * line, insufficient stock for an outbound movement) coming back through
 * as isError: true with the exact message intact, not a generic failure.
 *
 * Run with: npm run verify:write-tools
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import type { PurchaseOrder } from './types.js';

const PRODUCT = {
  _id: 'p1',
  sku: 'SKU-0001',
  name: 'Canvas Tote Bag',
  barcode: '8901000000001',
  unit: 'pcs',
  costPrice: 120,
  sellPrice: 220,
  reorderPoint: 15,
  reorderQty: 40,
  leadTimeDays: 7,
  trackLots: false,
  isActive: true,
};
const WAREHOUSE = { _id: 'w1', name: 'Pune Main', isActive: true };

function startStubServer(): Promise<{ server: http.Server; port: number }> {
  const purchaseOrders: PurchaseOrder[] = [];
  let stockQty = 0; // starts at zero, like a real ProductStock before any movement

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const readBody = (cb: (body: Record<string, unknown>) => void) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => cb(raw ? JSON.parse(raw) : {}));
    };

    if (url.pathname === '/products' && req.method === 'GET') {
      return send(200, { items: [PRODUCT], total: 1, page: 1, limit: 25 });
    }
    if (url.pathname === '/warehouses' && req.method === 'GET') {
      return send(200, { warehouses: [WAREHOUSE] });
    }

    if (url.pathname === '/purchase-orders' && req.method === 'GET') {
      return send(200, { orders: purchaseOrders });
    }
    if (url.pathname === '/purchase-orders' && req.method === 'POST') {
      return readBody((body) => {
        const lines = (body.lines as { productId: string; orderedQty: number; unitCost: number }[]).map((l) => ({
          ...l,
          receivedQty: 0,
        }));
        const po: PurchaseOrder = {
          _id: `po-${purchaseOrders.length + 1}`,
          poNumber: String(body.poNumber),
          supplierName: String(body.supplierName),
          warehouseId: String(body.warehouseId),
          status: 'draft',
          lines,
          createdAt: new Date().toISOString(),
        };
        purchaseOrders.push(po);
        send(201, { purchaseOrder: po });
      });
    }
    const receiveMatch = url.pathname.match(/^\/purchase-orders\/([\w-]+)\/receive$/);
    if (receiveMatch && req.method === 'PATCH') {
      return readBody((body) => {
        const po = purchaseOrders.find((p) => p._id === receiveMatch[1]);
        if (!po) return send(404, { error: 'Purchase order not found' });

        for (const receipt of body.lines as { productId: string; qty: number }[]) {
          const line = po.lines.find((l) => l.productId === receipt.productId);
          if (!line) return send(400, { error: `Product ${receipt.productId} is not on this purchase order` });
          const remaining = line.orderedQty - line.receivedQty;
          if (receipt.qty > remaining) {
            return send(400, {
              error: `Cannot receive ${receipt.qty} of product ${receipt.productId}: only ${remaining} remaining on the order`,
            });
          }
          line.receivedQty += receipt.qty;
        }
        po.status = po.lines.every((l) => l.receivedQty >= l.orderedQty)
          ? 'received'
          : po.lines.some((l) => l.receivedQty > 0)
            ? 'partially_received'
            : po.status;
        send(200, { purchaseOrder: po });
      });
    }

    if (url.pathname === '/barcode/movements' && req.method === 'POST') {
      return readBody((body) => {
        const type = String(body.type);
        const quantity = Number(body.quantity);
        const delta = type === 'outbound' ? -quantity : quantity;
        if (stockQty + delta < 0) {
          return send(409, {
            error: `Insufficient stock for product ${PRODUCT._id} in warehouse ${body.warehouseId}: available ${stockQty}, requested ${quantity}`,
          });
        }
        stockQty += delta;
        send(201, {
          movement: { _id: 'm1', productId: PRODUCT._id, warehouseId: body.warehouseId, type, quantity, referenceType: 'manual', createdAt: new Date().toISOString() },
          stock: { _id: 's1', productId: PRODUCT._id, warehouseId: body.warehouseId, quantity: stockQty, lastMovementAt: new Date().toISOString() },
        });
      });
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
  if (!child.stdin) throw new Error('child process has no stdin');
  child.stdin.write(JSON.stringify(msg) + '\n');
}

async function main() {
  const { server, port } = await startStubServer();

  const child = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, API_BASE_URL: `http://localhost:${port}`, MCP_SERVICE_TOKEN: 'test-token' },
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
          /* ignored — a non-JSON stdout line would be a protocol bug, caught implicitly by missing responses below */
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

  function toolText(res: JsonRpcResponse): string {
    return (res.result as { content?: { text?: string }[] } | undefined)?.content?.[0]?.text ?? '';
  }
  function isError(res: JsonRpcResponse): boolean {
    return !!(res.result as { isError?: boolean } | undefined)?.isError;
  }

  let failures = 0;
  function check(label: string, cond: boolean) {
    console.log(`  ${cond ? 'ok  ' : 'FAIL'} - ${label}`);
    if (!cond) failures++;
  }

  try {
    send(child, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'verify-script', version: '1.0.0' } } });
    await waitForResponse(1);
    send(child, { jsonrpc: '2.0', method: 'notifications/initialized' });

    // 1. create_purchase_order
    send(child, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'create_purchase_order',
        arguments: {
          supplierName: 'Acme Supplies',
          warehouseName: 'Pune Main',
          poNumber: 'PO-TEST-1',
          lines: [{ sku: 'SKU-0001', orderedQty: 10, unitCost: 50 }],
        },
      },
    });
    const createRes = await waitForResponse(2);
    const createText = toolText(createRes);
    check('create_purchase_order succeeds', !isError(createRes));
    check('create_purchase_order reports the PO number', createText.includes('PO-TEST-1'));
    check('create_purchase_order reports the product by name', createText.includes('Canvas Tote Bag'));

    // 2. receive_purchase_order — partial receipt
    send(child, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'receive_purchase_order', arguments: { poNumber: 'PO-TEST-1', lines: [{ sku: 'SKU-0001', qty: 4 }] } },
    });
    const receiveRes = await waitForResponse(3);
    const receiveText = toolText(receiveRes);
    check('receive_purchase_order succeeds', !isError(receiveRes));
    check('receive_purchase_order reports partial receipt correctly', receiveText.includes('4 / 10 received'));
    check('receive_purchase_order reports partially_received status', receiveText.includes('partially_received'));

    // 3. receive_purchase_order — over-receive, should fail with the REAL business message
    send(child, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'receive_purchase_order', arguments: { poNumber: 'PO-TEST-1', lines: [{ sku: 'SKU-0001', qty: 100 }] } },
    });
    const overReceiveRes = await waitForResponse(4);
    check('over-receiving returns isError', isError(overReceiveRes));
    check('over-receive error names the real remaining quantity (6)', toolText(overReceiveRes).includes('only 6 remaining'));

    // 4. record_stock_movement — inbound
    send(child, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'record_stock_movement', arguments: { barcode: '8901000000001', warehouseName: 'Pune Main', type: 'inbound', quantity: 20 } },
    });
    const movementRes = await waitForResponse(5);
    check('record_stock_movement succeeds', !isError(movementRes));
    check('record_stock_movement reports the new quantity (20)', toolText(movementRes).includes('20'));

    // 5. record_stock_movement — outbound exceeding stock, should fail with the REAL insufficient-stock message
    send(child, {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'record_stock_movement', arguments: { barcode: '8901000000001', warehouseName: 'Pune Main', type: 'outbound', quantity: 999 } },
    });
    const insufficientRes = await waitForResponse(6);
    check('insufficient-stock outbound returns isError', isError(insufficientRes));
    check('insufficient-stock error names the real available quantity (20)', toolText(insufficientRes).includes('available 20'));

    // 6. An unresolvable warehouse name should fail cleanly before ever hitting the API
    send(child, {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'record_stock_movement', arguments: { barcode: '8901000000001', warehouseName: 'Nonexistent Depot', type: 'inbound', quantity: 1 } },
    });
    const badWarehouseRes = await waitForResponse(7);
    check('unknown warehouse name fails with a resolver error, not a crash', isError(badWarehouseRes));
    check('unknown warehouse error lists the real available warehouse', toolText(badWarehouseRes).includes('Pune Main'));

    check('server process stayed alive throughout', child.exitCode === null);
  } finally {
    child.kill();
    server.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    if (stderrOutput) console.error('\n--- server stderr ---\n' + stderrOutput);
    process.exit(1);
  }
  console.log('\nAll write-tool checks passed, including real business-error passthrough.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
