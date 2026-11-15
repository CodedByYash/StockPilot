# Inventory Management System

Full-stack inventory management for small D2C/SMB brands — real-time stock
tracking, purchase/sales order flows, low-stock alerts, and velocity-based
reorder forecasting, built on the "ledger" design system (see
[`web/README.md`](web/README.md)).

```
inventory-project/
├── api/         Express + TypeScript + MongoDB backend — see api/README.md
├── web/         Next.js frontend — see web/README.md
└── mcp-server/  MCP server exposing the API as AI tools — see mcp-server/README.md
```

## Status

**Backend: all 7 planned phases complete.** Auth, products/warehouses, a
transactional stock ledger (the architectural core — every quantity change
goes through one function, wrapped in a MongoDB transaction), purchase
orders, sales orders with partial-fulfillment/backorder support, low-stock
+ velocity-based reorder alerts on scheduled jobs, a dashboard aggregation
endpoint, and a barcode lookup/scan-to-record API. Full detail and API
examples in [`api/README.md`](api/README.md).

**Frontend: complete per the original plan** — login, dashboard, products,
warehouses, purchase orders, sales orders, alerts, and camera-based barcode
scanning with PWA installability. Full detail in
[`web/README.md`](web/README.md).

## Project status: feature-complete

Every phase from the original 7-phase backend plan plus the full frontend
build is done and verified (`tsc`, production builds, and — where the
sandbox network allowed it — actual execution). What's left is genuinely
"nice to have next" rather than "missing": per-product movement history in
the UI, a standalone manual stock-adjustment form, multi-channel sync, and
swapping the generated placeholder icon for a real brand mark.

## Deploying

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for deploying the API, web app and MCP server to Vercel.

## Quick start

```bash
# 1. API
cd api
cp .env.example .env    # fill in MONGO_URI (Atlas free tier works) and JWT_SECRET
npm install
npm run seed             # 2 warehouses, 40 products, 90 days of history
npm run dev               # http://localhost:4000

# 2. Web (separate terminal)
cd web
cp .env.local.example .env.local
npm install
npm run dev                # http://localhost:3000
```

Log in with `admin@example.com` / `Password123!` (created by the seed
script).

## What's genuinely differentiated here

Most competitors in this space (Cin7, NetSuite, Katana) treat velocity-based
reorder forecasting as a premium add-on bolted onto a static reorder-point
system. Here it's built into the core flow from day one — `forecastService`
computes real sales velocity from the stock ledger and generates
plain-English reorder suggestions ("~10 days of stock left at 1.2 units/day,
due to run out before lead time"), with zero ML infrastructure. See
`api/src/services/forecastService.ts`.

## What's not built

- PWA icon is a generated placeholder monogram, not a designed brand mark
- Multi-channel sync (Shopify/WooCommerce webhooks) — deliberately out of
  scope per the original plan, listed there as a believable roadmap item
- Per-product stock movement history view in the UI (API endpoint exists)
- A standalone manual stock-adjustment form outside the PO/scan flows
