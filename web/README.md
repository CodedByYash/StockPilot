# Inventory Management System — Web

Next.js (App Router) frontend for the [API](../api). Talks to it entirely over
REST with `credentials: 'include'` — the httpOnly JWT cookie set by
`/auth/login` is sent automatically, the frontend never touches the token.

## Design system — "Ledger"

Dark ink/paper palette, not the generic cream+serif or near-black+neon
defaults. The visual language comes from paper ledgers and ink stamps, not
SaaS gradients — see the comment block at the top of `app/globals.css` for
the full token rationale (colors, type roles, the "stamp" signature element
used for alerts).

Fonts are system stacks on purpose (no `next/font/google`), so the build has
no external font fetch and no FOUT.

## Pages built

- `/login` — sign in (first registered user becomes admin, via the API)
- `/dashboard` — KPI cards (stock value, total units, open alerts), the
  "ledger tape" recent-activity feed, top movers, open alerts panel
- `/scan` — camera-based barcode scanning: point at a barcode (or type one
  in manually), see the product and its stock across every warehouse, and
  record a movement (receive/ship/adjust) directly from the result without
  ever looking up a product ID. Uses `react-zxing`'s `useZxing` hook, which
  ponyfills the native `BarcodeDetector` API where the browser supports it
  and falls back to WASM decoding where it doesn't — no manual
  native-vs-fallback branching needed in `components/BarcodeScanner.tsx`.
- `/products` — search, paginate, create/edit/deactivate. Full form covering
  every `Product` field including `reorderPoint`, `reorderQty`,
  `leadTimeDays`, and `barcode`
- `/warehouses` — list, create, deactivate
- `/purchase-orders` — list with per-line received/ordered progress, create
  with dynamic line items, mark-ordered, and a receive flow that shows
  remaining quantity per line
- `/sales-orders` — mirrors purchase orders: create, a fulfill flow that
  makes the partial-fulfillment/backorder behavior visible (shows
  "N backordered" per line rather than hiding it), cancel
- `/alerts` — filter open/resolved/all, resolve individually, and a
  "Run checks now" button that manually triggers both the low-stock and
  forecast checks on the API instead of waiting for their cron schedules

## PWA — installable on a phone

- `app/manifest.ts` — Next's file-convention manifest route, auto-linked
  into every page's `<head>`. `start_url` goes straight to `/dashboard`
  since that's where an installed app should land, not the login-redirect
  root.
- `app/icon-192/route.tsx` and `app/icon-512/route.tsx` — the app icon is
  generated on request via `next/og`'s `ImageResponse` (see
  `lib/icon.tsx`), not a static asset. It reuses the exact ink/amber tokens
  from the design system rather than a separately-designed logo, and both
  routes were verified to actually return real PNGs at the correct
  dimensions (checked with `file` on the response bytes, not just a 200
  status).
- `public/sw.js` + `components/ServiceWorkerRegister.tsx` — a deliberately
  minimal service worker: caches the app shell (login/dashboard/root) with
  a stale-while-revalidate strategy, and explicitly never caches `/api/*`
  or non-GET requests, because inventory data must always be live. This is
  the honest amount of "offline support" for an API-driven app — not a
  promise of full offline data access.

## Not built yet

- Stock movement history view for a single product (the API has
  `GET /stock/:productId/history`, not surfaced in the UI yet)
- A "receive/adjust stock manually" flow outside of PO receiving and the
  scan page — `POST /stock/movements` exists on the API but isn't wired to
  a standalone UI form (the scan page's record-movement form covers the
  barcode path; a non-barcode equivalent on the product detail view would
  be the natural next addition)

## Setup

```bash
cd web
cp .env.local.example .env.local   # points NEXT_PRIVATE_API_URL at the API
npm install
npm run dev                         # http://localhost:3000
```

Needs the API running (see `../api/README.md`) — start that first, run its
seed script, then log in here with `admin@example.com` / `Password123!`.

## Verified

`npx tsc --noEmit` and `npm run build` both pass clean across all 14 routes
(8 pages + the manifest route + 2 icon routes + root/not-found/login-etc
internals). The dev server was also booted and hit directly: `/login`,
`/dashboard`, and `/scan` all returned 200 with no server errors,
`/manifest.webmanifest` returned valid parseable JSON, and both icon routes
were confirmed via `file` to return real PNGs at 192×192 and 512×512 — not
just checked for a 200 status. This isn't just type-checked, it actually
runs.

## Next step

The frontend now covers every page from the original plan, including
barcode scanning and PWA installability. Reasonable next additions: a
per-product stock movement history view, a standalone manual
receive/adjust form outside the PO/scan flows, and swapping the
placeholder monogram icon for a real brand mark if this becomes more than
a portfolio project.
