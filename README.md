# StockSense

**Odoo × GCET hackathon** — a modular inventory management system that replaces registers and spreadsheets with one real-time ledger. Products, receipts, deliveries (pick → pack → validate), internal transfers, stock counts, move history, multi-warehouse, and a dashboard that explains itself.

> **The idea that holds it together:** on-hand stock is never stored. Every quantity on every screen is computed from an append-only, double-entry ledger of stock moves — so any number can be clicked through to the exact moves that produced it, and the books always balance.

---

## What it does (mapped to the problem statement)

| Problem statement | StockSense |
|---|---|
| Sign up / log in, **OTP password reset**, land on the dashboard | scrypt-hashed passwords, httpOnly sessions, 6-digit single-use OTP with expiry and attempt limit; demo mode shows the code on screen (no email server) |
| Dashboard KPIs: products in stock · low / out of stock · pending receipts · pending deliveries · internal transfers scheduled | All five, each a link to the exact list it counts, with the same scope |
| Dynamic filters: document type · status · warehouse or location · category | On the dashboard, every operations list, products and move history — kept in the URL |
| Products: create/update, stock per location, categories, reordering rules, UoM, optional initial stock | Initial stock is posted as an audited "Initial stock" adjustment, not a silent number; min/max reordering rules drive smart reorder suggestions |
| Receipts → validate → stock increases | Draft → Ready → Done; vendor → shelf moves |
| Delivery orders: pick → pack → validate → stock decreases | Per-line picking, packing, and an availability guard that explains shortages ("Only 12 kg of Steel Rods on hand at HYD/Stock — 40 kg requested") |
| Internal transfers (Main → Production floor, Rack A → Rack B, Warehouse 1 → 2) | Any internal location to any other; totals unchanged, locations updated |
| Stock adjustments: counted quantity → auto-update and log | Posts only the difference; the document keeps recorded vs counted |
| Move history / stock ledger | Filters, running balance, CSV export (formula-injection safe) |
| Settings → warehouses; profile menu with logout | Warehouses, locations, utilization; profile + logout in the sidebar |
| Low-stock alerts · multi-warehouse · SKU search & smart filters | Alert centre, ⌘K search by SKU, faceted filters everywhere |
| The spec's worked example (100 kg steel → rack → deliver 20 → 3 kg damaged) | Replayed exactly by an automated test (`tests/e2e/spec-example.spec.ts`) |

**Beyond the brief:** explainable Inventory Health Score · one-click reorder from an alert · 30-day stock-flow chart · live updates across windows (Server-Sent Events) · ABC analysis & inventory turnover · animated warehouse floor map · ⌘K command menu · dark mode · WCAG AA (automated axe scan) · works at 390 px.

---

## Run it

Requires **Node 22.13+** (uses the built-in `node:sqlite` — no native modules to compile).

```bash
npm install
npm run dev          # web on http://localhost:5173, API on :3001 (proxied at /api)
```

Sign in with the prefilled demo account — `demo@stocksense.in` / `demo1234`. The first start seeds 90 days of realistic history (3 warehouses, 34 products, ~900 documents). **Settings → General → Reset demo data** restores it at any time.

| Script | What it runs |
|---|---|
| `npm run lint` | oxlint, warnings are errors |
| `npm run build` | type-check (web, API, shared, tests) + production build |
| `npm run test` | Vitest: domain, services, API, SSE, rate limits (92 tests) |
| `npm run test:smoke` | Playwright end-to-end, including the demo story, accessibility and mobile checks (40 tests) |

End-to-end tests start their own servers (ports 5174 / 3002) on their own database (`data/e2e.db`), reset to the demo seed before every run — they never touch a running dev server or its data.

---

## Architecture

```
React 19 + Vite ──/api──► Express 5 ──► services (rules, transactions) ──► repos (SQL) ──► SQLite
       │                      │
       └── shared/domain ─────┘   pure TypeScript: types, zod schemas, lifecycle, move planning,
                                  health score, reorder — used by both sides
```

- **Ledger, not counters.** `stock_moves` is append-only (database triggers reject UPDATE/DELETE); `stock_quants` is a view. Every move is double-entry between locations, with virtual *Vendors*, *Customers* and *Inventory adjustment* locations — so Σ over all locations is zero for every product (tested).
- **One transaction per validation.** Availability is re-checked against the live ledger, moves are planned by pure functions, appended, and the document marked done — or nothing happens. A Ready document that has lost its stock is moved back to Waiting, never left claiming readiness.
- **Documents follow Odoo's lifecycle.** Draft → Waiting → Ready → Done / Canceled, references like `HYD/OUT/00042`; done documents are immutable (corrections are new adjustments).
- **Security basics.** scrypt, hashed session tokens and OTPs, rate limits, zod validation on every input, parameterised SQL only, helmet, one JSON error envelope.

More detail — data model, flows and decisions — in [`docs/architecture.md`](docs/architecture.md). The pitch script is [`docs/DEMO.md`](docs/DEMO.md).

---

## Deploy

The web app goes to **Vercel**, the API to **Render**; Vercel rewrites `/api/*` to Render so the browser sees one origin (first-party cookies).

1. **API — Render:** New → Blueprint → this repository. `render.yaml` defines the service (`stocksense-api`, Node 22.13.1, health check `/api/health`). The free tier's disk is ephemeral, so the demo re-seeds on each cold start.
2. **Web — Vercel:** import the repository; `vercel.json` sets the build and rewrites. If Render gives the service a different URL, update the `/api/:path*` destination in `vercel.json`.
3. Open the Vercel URL and sign in with the demo account. Warm the API first (`/api/health`) — a free Render instance sleeps after inactivity.

**Known limits of this setup:** Vercel closes proxied connections after 120 s, so the live-update stream reconnects every two minutes; the client refetches on each reconnect, so no change is missed. Login and OTP rate limits are per account, so they hold even if someone calls the Render URL directly with forged proxy headers.

Environment variables are documented in [`.env.example`](.env.example).
