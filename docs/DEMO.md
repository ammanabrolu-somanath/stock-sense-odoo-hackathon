# StockSense — 3-minute demo script

Rehearsed and regression-tested: `tests/e2e/demo-story.spec.ts` clicks exactly this path and verifies the stock after every step.

**Before you start:** Settings → General → *Reset demo data* (fresh, known numbers). Keep a second browser window open on the dashboard for step 9's "live" moment.

| # | Do | Say |
|---|---|---|
| 1 | **Sign in** — the demo account is prefilled. | "Real accounts, hashed passwords, OTP reset — but no friction on stage." |
| 2 | **Dashboard.** Point at the five KPIs, the health score and the low-stock alerts. | "These are the five numbers the brief asked for. Every one is a link to the exact list it counts — and every quantity comes from one ledger." |
| 3 | **Products → New product** (`N`): *Wireless Barcode Scanner*, Electronics, min 10 / max 60. | "No stock yet. Stock only ever changes through documents." |
| 4 | **Receive stock** → supplier, *HYD/Stock*, 50 → **Validate receipt**. | "Validated: +50. Nothing is edited — a move was posted." |
| 5 | **Transfers → New**: HYD/Stock → BLR/Stock, 20 → **Validate**. | "Total unchanged, location updated — exactly the spec's example." |
| 6 | **Deliveries → New**: HYD/Stock, type **40**. | "It tells me there are only 30 before I even save." Change to **25** → Confirm → **Pick all** → **Mark packed** → **Validate**. "Pick, pack, ship — the button stays disabled until each step is done." |
| 7 | **Adjustments → New**: BLR/Stock, reason *Damaged*, counted **18**. | "Recorded 20, counted 18 — only the −2 difference is posted, and the document keeps both numbers." |
| 8 | Product page → click the **on-hand number**. | "Move History for this product: four moves, and the running balance ends at exactly what's on hand. Every number in the app works like this." |
| 9 | **Dashboard → Low stock alerts → Reorder** on the first item → **Validate receipt**. | "One click drafted the receipt from the smart suggestion — supplier, quantity, location. Received: the alert is gone and the health score responds." *(Second window: its numbers update live.)* |

**If asked:** open **Analytics** (ABC classes, turnover), a **warehouse floor map** (Settings → Warehouses → HYD), **⌘K** (search by SKU), or toggle **dark mode**. The spec's steel example is replayed by `tests/e2e/spec-example.spec.ts`.

**Backup:** if the network is down, run locally (`npm run dev`) — the deployed and local builds are identical.
