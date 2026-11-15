# Inventory Management System — API (Phase 0-7, backend complete)

## What's built here

- Project scaffolding (TypeScript strict mode, Express, Mongoose)
- Auth: register/login/logout via JWT in an httpOnly cookie, role-based middleware (`admin` / `manager` / `staff`)
- `Product` and `Warehouse` CRUD
- **The stock ledger engine** — the core of the whole project:
  - `StockMovement`: append-only source-of-truth collection
  - `ProductStock`: derived/cached current-quantity collection
  - `stockService.recordMovement()`: the *only* function allowed to write to either collection, wrapped in a MongoDB transaction so a movement insert and a quantity update always succeed or fail together
  - Rejects any outbound/transfer movement that would push stock negative (`InsufficientStockError`)
- Concurrency test suite (`src/tests/stockService.test.ts`) that fires 50 concurrent writes at one product and asserts the final quantity is exactly correct — this is the test that proves the design, not just documents it
- Seed script generating 2 warehouses, 40 products, and ~90 days of simulated movement history
- **Purchase orders** (`PurchaseOrder` model + `purchaseOrderService`):
  - Create a draft PO with line items (product, ordered qty, unit cost)
  - Mark as ordered
  - Receive against it — partially or fully, one or many lines at a time. Each receipt line calls `recordMovement('inbound', ...)` with `referenceType: 'purchaseOrder'` so the ledger always shows *why* stock arrived
  - Rejects over-receipt (can't receive more than `orderedQty - receivedQty` on a line) and receiving against a product not on the order
  - Status auto-transitions: `draft` → `ordered` → `partially_received` → `received`
  - Deliberately **not** one giant transaction across every line in a receipt — if line 2 of 3 fails, lines already recorded stay recorded, because that shipment genuinely did partially arrive. See the comment in `purchaseOrderService.ts` for the reasoning.
  - Test suite (`purchaseOrderService.test.ts`) covering partial receipt, full receipt, over-receipt rejection, and receiving against a product not on the order
- **Sales orders** (`SalesOrder` model + `salesOrderService`) — the mirror of purchase orders, outbound side:
  - Create a pending SO with line items (product, qty, unit price)
  - Fulfill against it — **partial fulfillment + implicit backorder** is the default behavior: each line fulfills as much as current stock allows (up to what's requested), and whatever's short stays outstanding on the order (`qty - fulfilledQty`, no separate backorder field, it's derived)
  - Status auto-transitions: `pending` → `partially_fulfilled` → `fulfilled`, plus `cancelled`
  - You can call fulfill again later (e.g. after restocking) to top up a partially fulfilled order
  - Race-safety: fulfillment attempts the full requested qty first; if `recordMovement`'s transaction rejects it as insufficient (concurrent order grabbed the stock first), it re-checks current stock and retries once for whatever's actually available — never oversells, because the real guard lives inside `recordMovement`'s transaction, not in a pre-check here
  - `cancelSalesOrder` — blocked once an order is fully fulfilled (use a return/adjustment instead)
  - Test suite (`salesOrderService.test.ts`) covering full fulfillment, partial fulfillment/backorder, zero-stock lines, topping up a backorder later, over-request rejection, and cancellation rules

  **If you'd rather hard-reject an order that can't be fully filled instead of partial-fulfilling**, that's a one-function change — see the comment at the top of `fulfillSalesOrder` in `salesOrderService.ts`.

- **Alerts + Dashboard** (`AlertLog` model, `alertService`, `dashboardService`):
  - `runLowStockCheck()` — joins current stock against each product's `reorderPoint`. Only products with `reorderPoint > 0` are considered (a product left at the default 0 is treated as "not opted into alerting," not "alert only at literal zero")
  - Deduplicates: won't create a second open alert for something already flagged
  - Auto-resolves: once a product is restocked above threshold, any open alert for it gets marked resolved automatically on the next check
  - Scheduled hourly via `node-cron` (`jobs/lowStockCheck.ts`) in dev — in production this is designed to map onto an AWS Lambda on an EventBridge schedule calling the same `runLowStockCheck()` function, just with a different trigger
  - `POST /alerts/run-check` — manually trigger a check on demand (useful for demos, don't want to wait for the cron)
  - Dashboard aggregations (`dashboardService.ts`): total stock value (`Σ quantity × costPrice`), total units, open low-stock alert count, top 5 movers by outbound quantity over the last 30 days, and a recent-activity feed of the last 20 stock movements
  - Test suite (`alertService.test.ts`) covering alert creation, dedup on repeated runs, non-alerting above threshold, the `reorderPoint: 0` opt-out behavior, and auto-resolve on restock

- **Barcode backend** (`Product.barcode` field, `barcodeService`) — the server-side half of Phase 6; the camera/scanning UI itself is frontend work, not built here yet:
  - `Product.barcode` — optional, sparse-unique index (not every product needs one, but any that do must be unambiguous)
  - `GET /barcode/:code` — scan-and-see: resolves a code to its product plus current stock in every warehouse it exists in. This is what a warehouse worker sees the instant they scan something.
  - `POST /barcode/movements` — scan-to-record: resolves the barcode to a product internally and calls the same `recordMovement()` used everywhere else, so a phone scanning workflow never needs to know a product's Mongo ID, just its barcode. Same transactional guarantees and `InsufficientStockError` behavior as every other path into the ledger.
  - Seed script now assigns each of the 40 demo products a fake-but-unique barcode, so `GET /barcode/:code` has something to demo against immediately after seeding.
  - Test suite (`barcodeService.test.ts`) covering lookup, unknown-code rejection, ignoring inactive products, scan-to-record, and rejecting a record against an unrecognized code

- **Forecasting / reorder intelligence** (`Product.leadTimeDays`, `forecastService`) — this is the genuine differentiator from the original research: most competitors bolt AI forecasting on as a premium add-on; this is built into the core reorder flow with no ML infra:
  - `getDailyVelocity()` — average outbound quantity/day over a rolling 30-day window, a plain moving average (deliberately not exponential smoothing yet — simplest thing that's still honest about recent demand; the comment in `forecastService.ts` notes where to swap it in later if plain averaging proves too noisy for spiky SKUs)
  - `getForecastForProduct()` — combines velocity with current stock and the product's `leadTimeDays` (new field, defaults to 7) to compute `daysOfStockRemaining`, and flags `reorderSuggested` when that's due to hit zero before a reorder could arrive. Also computes a `suggestedReorderQty` (velocity × lead time × 1.2 buffer) and a plain-English `reason` string — e.g. *"~10.0 days of stock left at 1.00 units/day, due to run out before lead time — suggest reordering ~18 units."*
  - `GET /forecast/:productId` — forecast for one product across every warehouse (or scoped to one with `?warehouseId=`)
  - `runReorderCheck()` — the nightly job (2 AM cron via `jobs/reorderCheck.ts`), same create/dedupe/auto-resolve pattern as the low-stock check, but driven by velocity instead of a static threshold. The two alert types complement each other: `reorderPoint` catches sudden drops regardless of sales history, `reorder_suggested` catches slow-bleed items *before* they ever cross a manually-set threshold.
  - `POST /forecast/run-check` — manual trigger for demos
  - Test suite (`forecastService.test.ts`) — this one actually verifies the math: backdates simulated sales across the 30-day window and asserts the exact velocity, days-remaining, and reorder-suggested outcomes by hand-computed expectation, not just "doesn't throw"

  **A correctness fix that came out of building this**: the seed script's outbound movements were previously all landing on the same timestamp (`recordMovement` always stamped "now"), which would have quietly broken the honesty of the 30-day velocity window. Fixed by adding an `occurredAt` override to `RecordMovementInput` — used only by the seed script to backdate history, never exposed on any public API route (a real movement always happens *now*; letting a client claim otherwise would let stock history be falsified). Seeded sales are now genuinely spread across the last 90 days.

## Backend is now feature-complete per the original 7-phase plan

Everything left is frontend: the Next.js client (nothing built yet), the dashboard UI on top of `/dashboard/summary`, and the camera-based scanning UI that calls the barcode endpoints from Phase 6.
- Frontend (Next.js) — nothing built yet on the client side

## Setup

```bash
cd api
cp .env.example .env      # then fill in MONGO_URI and JWT_SECRET
npm install
npm run dev                # starts the API on http://localhost:4000
```

You need a real MongoDB (Atlas free tier, or local `mongod`) — transactions require a replica set, which a bare standalone `mongod` is not by default. Atlas connections are replica sets out of the box, so that's the easiest path.

## Seed demo data

```bash
npm run seed
```

Creates an admin user: `admin@example.com` / `Password123!`

## Run tests

```bash
npm test
```

Uses `mongodb-memory-server`, which downloads a real mongod binary on first run (needs internet access to `fastdl.mongodb.org` — this domain isn't reachable from the sandbox that built this project, which only allows npm/pip/GitHub domains, so I could type-check but not execute the suite here). It spins up a one-node replica set locally so transactions work in tests exactly like they do in Atlas. Run it on your own machine and it should download the binary and pass cleanly — the logic itself has been type-checked end to end (`tsc --noEmit` is clean across all four phases).

## Try it manually

```bash
# register (first user becomes admin)
curl -c cookies.txt -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Yash","email":"yash@example.com","password":"password123"}'

# create a warehouse
curl -b cookies.txt -X POST http://localhost:4000/warehouses \
  -H "Content-Type: application/json" \
  -d '{"name":"Pune Main"}'

# create a product
curl -b cookies.txt -X POST http://localhost:4000/products \
  -H "Content-Type: application/json" \
  -d '{"sku":"SKU-0001","name":"Test Product","costPrice":100,"sellPrice":160}'

# record an inbound stock movement (replace ids with real ones from above)
curl -b cookies.txt -X POST http://localhost:4000/stock/movements \
  -H "Content-Type: application/json" \
  -d '{"productId":"<id>","warehouseId":"<id>","type":"inbound","quantity":50,"referenceType":"manual"}'

# check current stock
curl -b cookies.txt http://localhost:4000/stock/<productId>/<warehouseId>

# create a purchase order
curl -b cookies.txt -X POST http://localhost:4000/purchase-orders \
  -H "Content-Type: application/json" \
  -d '{
    "poNumber":"PO-1001",
    "supplierName":"Acme Supplies",
    "warehouseId":"<warehouseId>",
    "lines":[{"productId":"<productId>","orderedQty":100,"unitCost":80}]
  }'

# mark it ordered
curl -b cookies.txt -X PATCH http://localhost:4000/purchase-orders/<poId>/mark-ordered

# receive part of it (partial receipt)
curl -b cookies.txt -X PATCH http://localhost:4000/purchase-orders/<poId>/receive \
  -H "Content-Type: application/json" \
  -d '{"lines":[{"productId":"<productId>","qty":60}]}'

# create a sales order
curl -b cookies.txt -X POST http://localhost:4000/sales-orders \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber":"SO-2001",
    "warehouseId":"<warehouseId>",
    "lines":[{"productId":"<productId>","qty":15,"unitPrice":160}]
  }'

# fulfill it (will partially fulfill + backorder if stock is short)
curl -b cookies.txt -X PATCH http://localhost:4000/sales-orders/<soId>/fulfill \
  -H "Content-Type: application/json" \
  -d '{"lines":[{"productId":"<productId>","qty":15}]}'

# manually trigger the low-stock check (instead of waiting for the hourly cron)
curl -b cookies.txt -X POST http://localhost:4000/alerts/run-check

# view open alerts
curl -b cookies.txt http://localhost:4000/alerts?resolved=false

# dashboard summary (optionally scope to one warehouse with ?warehouseId=<id>)
curl -b cookies.txt http://localhost:4000/dashboard/summary

# scan a barcode: see the product + stock across all warehouses
curl -b cookies.txt http://localhost:4000/barcode/8901000000001

# scan-to-record: receive stock by barcode without knowing the product id
curl -b cookies.txt -X POST http://localhost:4000/barcode/movements \
  -H "Content-Type: application/json" \
  -d '{"barcode":"8901000000001","warehouseId":"<warehouseId>","type":"inbound","quantity":20}'

# get the reorder forecast for a product across all warehouses
curl -b cookies.txt http://localhost:4000/forecast/<productId>

# manually trigger the nightly reorder check now
curl -b cookies.txt -X POST http://localhost:4000/forecast/run-check
```

## Next step

The backend covers all 7 phases from the original plan. Next is the Next.js frontend: dashboard, product/warehouse management, PO/SO flows, and the camera-based barcode scanning UI (PWA manifest + `BarcodeDetector` API or `react-zxing`) that calls `GET /barcode/:code` and `POST /barcode/movements`. Ask Claude to scaffold it next when ready.
