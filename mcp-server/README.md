# Inventory MCP Server

An MCP (Model Context Protocol) server that exposes the [inventory API](../api)
as tools an AI assistant can call directly — "what's low on stock in Pune?",
"create a PO for 50 units of SKU-0012 from Acme Supplies", answered by
actually calling your real API, not by guessing.

This is a thin translation layer. All business logic (the stock ledger,
transactions, validation) stays in `../api` — this project has no database
access of its own.

## Status: Step 1 + 2 of the build plan done

- **Step 1** — a server with zero tools that proves the stdio transport
  actually connects. Verified by piping a real JSON-RPC `initialize`
  request into it and getting back a correct protocol handshake — not
  just "the process doesn't crash."
- **Step 2** — auth plumbing:
  - `../api/src/middleware/auth.ts` now accepts `Authorization: Bearer
    <token>` as well as the existing session cookie (needed because this
    process has no browser to hold a cookie in). 6 tests
    (`../api/src/tests/auth.middleware.test.ts`) actually pass, covering
    both paths, precedence when both are present, and rejection of
    malformed/wrong-secret tokens.
  - `../api/src/scripts/createServiceAccount.ts` — creates (or reuses) a
    non-interactive service account and mints a long-lived JWT for it.
    Deliberately separate from `seed.ts`, which wipes data on every run —
    you don't want your MCP token invalidated every time you reseed demo
    data.
  - `src/apiClient.ts` — the one function every tool will call through.
    Verified against a real local HTTP server (`npm run verify`, no Mongo
    or running API needed) — confirms the Bearer header actually goes out
    on the wire, request/response bodies round-trip correctly, and API
    error responses map to a typed `ApiClientError` with the real message
    preserved, not a generic one.

All 8 planned tools are now built — the MCP server covers the full phased
plan.

- **Step 4** — the first 5 tools, all read-only, registered in `src/index.ts`:
  - `check_stock` — SKU → stock across one or every warehouse, with reorder point
  - `search_products` — text search by name/SKU
  - `get_low_stock_alerts` — open (or all) alerts
  - `get_forecast` — velocity-based reorder forecast by SKU
  - `get_dashboard_summary` — stock value, unit count, top movers, optionally scoped to one warehouse

  Verified at the strongest level yet: `npm run verify:tools` spawns the
  **actual compiled server as a real child process**, drives it through a
  genuine MCP handshake (`initialize` → `notifications/initialized` →
  `tools/list` → `tools/call`) over its real stdin/stdout, against a stub
  HTTP server standing in for the API. All 8 checks pass — confirming the
  full pipeline end to end: stdio transport → tool registration → zod
  input validation → resolver → `apiClient` → real HTTP → response
  formatting → JSON-RPC response, including the error path (an unknown
  SKU correctly comes back as `isError: true`, not a crash).

- **Step 5** — the 3 write tools:
  - `create_purchase_order` — resolves the warehouse and every line's SKU
    *before* creating anything, so a typo'd SKU fails the whole request
    rather than creating a PO with some lines silently missing
  - `receive_purchase_order` — resolves a PO by number (`resolvers.ts`'s
    `resolvePurchaseOrderByNumber`, new this step — same honest
    scale-caveat as the SKU resolver, documented in the code), supports
    partial receipt
  - `record_stock_movement` — inbound/outbound/adjustment by barcode (no
    `transfer`, deliberately — a transfer needs two warehouse legs, out of
    scope for a single tool call, same reasoning the frontend's scan page
    already uses)

  Verified with a new `verifyWriteTools.ts`, same spawned-real-process
  approach as step 4's script, but this time the point of the exercise was
  the *error* path, not just the happy path: a stub API returns real
  business-rule failures (over-receiving a PO line past what's left,
  outbound movement exceeding available stock) in the exact shape the real
  services (`PurchaseOrderError`, `InsufficientStockError`) produce, and
  all 15 checks confirm those real messages — "only 6 remaining",
  "available 20" — survive intact all the way out to the tool's
  `isError: true` result, not flattened into a generic failure message.
  An unresolvable warehouse name is checked too, confirming the resolver
  layer fails cleanly before ever reaching the API.

  **One regression caught and fixed while building this**: adding 3 tools
  made `verifyTools.ts` (step 4's script) fail, because it hard-coded an
  exact-equality check against a list of exactly 5 tool names. Not a
  product bug — the server was correctly reporting 8 tools — but a stale
  assertion in the verification script itself. Fixed by changing it to
  check that the read-only tools are a *subset* of what's registered,
  which won't break again as more tools are added later.

- **Step 3** — `src/resolvers.ts`: `resolveProductBySku` and
  `resolveWarehouseByName`, the shared lookups nearly every tool depends
  on, so a person or an AI assistant never needs to paste a MongoDB
  ObjectId. Both verified against a real HTTP round trip
  (`npm run verify:resolvers`, 8/8 checks pass) covering exact match,
  case-insensitivity, whitespace trimming, and two different not-found
  shapes (near-miss with suggestions vs. genuinely unknown).

  **Known limitation, documented rather than hidden**: `resolveProductBySku`
  goes through the API's existing `GET /products?search=` endpoint (there's
  no dedicated exact-match-by-SKU endpoint) and filters for an exact match
  among the results. Fine at this project's scale (tens of SKUs); at real
  catalog scale (thousands of SKUs) search relevance ranking could push an
  exact match off the page the resolver looks at. The honest fix is a
  dedicated `GET /products/by-sku/:sku` endpoint on the API doing an
  indexed exact query — not built now, to keep this session's scope to the
  MCP layer rather than expanding the backend again. `resolveWarehouseByName`
  has no such caveat — `GET /warehouses` is unpaginated and warehouse
  counts are always small.

## Setup

```bash
# 1. In ../api: generate a service-account token (needs the API's own
#    .env already configured with MONGO_URI and JWT_SECRET)
cd ../api
npm run create-service-account
# copy the printed token

# 2. Back here
cd ../mcp-server
cp .env.example .env
# paste the token into MCP_SERVICE_TOKEN, set API_BASE_URL if not localhost:4000
npm install
```

## Verify the setup

```bash
npm run verify             # sanity-checks apiClient.ts against a throwaway local server
npm run verify:resolvers   # sanity-checks resolvers.ts the same way
npm run verify:tools       # spawns the REAL server, drives it through a real MCP handshake end to end (read-only tools)
npm run verify:write-tools # same, for the write tools — including real business-error passthrough
```

Once ../api is actually running (`npm run dev` in that folder) with your
token in `.env` here, you'll be able to run the MCP server itself:

```bash
npm run dev   # runs src/index.ts directly via tsx
```

It speaks MCP over stdio — it's not a thing you open in a browser. Point an
MCP client (Claude Desktop's config, Claude Code, etc.) at
`node dist/index.js` (after `npm run build`) or `npx tsx src/index.ts` for
dev, and it'll show up as a connected server once tools exist to register.

## Design notes worth knowing

- **Why a service account instead of per-user login**: there's no
  interactive login flow in an MCP context — no browser, no form. A
  service account with a long-lived token is the honest solution for "one
  person runs this locally," which is the actual use case here. See the
  comment in `createServiceAccount.ts` for the fuller reasoning, including
  why it's `role: 'manager'` and not `admin`.
- **Env vars are read lazily, not captured at module load** — `apiClient.ts`
  reads `process.env.API_BASE_URL` / `MCP_SERVICE_TOKEN` inside `apiFetch()`
  itself, not as module-level constants. This was a real bug caught while
  building the verify script: capturing at import time makes correctness
  depend on import order (something loading `dotenv/config` has to run
  before this module is *first* imported, anywhere in the chain) — fragile,
  and it broke on the very first run of the verify script. Reading lazily
  removes that hazard entirely.

## Next step

All 8 tools from the original plan are built and verified. What's left is
step 6 from the original proposal — actually connecting a real MCP client
(Claude Desktop) to this and running through it conversationally, plus a
short demo script for a resume/interview context. Everything up to that
point has been verified at the protocol level in this sandbox; connecting
a real client is the one thing that genuinely needs to happen on your own
machine.

To try it with Claude Desktop once `../api` is running with real data:

```json
{
  "mcpServers": {
    "inventory": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-server/src/index.ts"],
      "env": {
        "API_BASE_URL": "http://localhost:4000",
        "MCP_SERVICE_TOKEN": "<the token from create-service-account>"
      }
    }
  }
}
```

(Path to this file depends on your OS — Claude Desktop's settings will
show you where its config lives.)

## Remote (HTTP) mode

`src/http.ts` serves the same 8 tools over MCP's Streamable HTTP transport,
for hosting on Vercel (stdio can't run there). It requires
`MCP_AUTH_TOKEN` as a bearer token and refuses everything if it isn't set.
See [`../DEPLOYMENT.md`](../DEPLOYMENT.md) for the deploy steps and client
config. Local stdio use (above) is unchanged.
