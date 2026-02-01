# Next Steps — Priority Order

## Immediate Fixes (Before Beta Testers)

### ~~1. Data API Zod schemas need `.passthrough()`~~ DONE
Added `.passthrough()` to `PositionSchema` and `ActivitySchema` in `packages/api/src/data/index.ts`.

### ~~2. SELL orders need ERC-1155 approval~~ DONE
Added `useConditionalTokenApproval(negRisk)` hook. Checks `isApprovedForAll` on CTF contract, prompts `setApprovalForAll` TX. SELL button gated on approval. Supports both regular and neg-risk markets.

### ~~3. MAX button for BUY~~ DONE
Added BUY MAX button in market page trade panel. Calculates `Math.floor((effectiveBalance - 0.50) / (price / 100))` with $0.50 USDC reserve. Shows alongside the existing SELL MAX button (which fills position size).

### ~~4. Rebrand PolyExplorer -> Neomarket~~ DONE
Metadata title and header logo changed to "Neomarket" in `layout.tsx`.

---

## ~~Sprint 6 Completion~~ DONE

### ~~5. Open Orders UI~~ DONE
Added "Orders" tab to market page and portfolio page. Shows side, price, size, filled, time, and cancel button per order.

### ~~6. Order Cancellation UI~~ DONE
Cancel button per order with confirmation dialog on portfolio page. Toast on success/failure. Uses `useCancelOrder()` hook.

### ~~7. Transaction Confirmation Flow~~ DONE
Order button shows status progression: "Awaiting signature..." → "Submitting order..." → "Order placed!" with spinner. Auto-refreshes positions 3s after success.

---

## Data Sources — Current vs Future

### Current: Polymarket APIs
```
Positions:  data-api.polymarket.com/positions?user=ADDRESS
Activity:   data-api.polymarket.com/activity?user=ADDRESS
Orderbook:  clob.polymarket.com/book?token_id=TOKEN
Trades:     clob.polymarket.com/trades?token_id=TOKEN  (may need L2 auth)
Balance:    clob.polymarket.com/balance-allowance (L2 auth)
Markets:    Indexer at 138.201.57.139:3005
```

### Future: ClickHouse Database
When the ClickHouse DB is ready, we can:
- Query trades directly (bypasses CLOB `/trades` auth requirement)
- Get historical position data
- Build portfolio value charts over time
- Calculate custom analytics (volume by market, P&L over time)
- Power the trades tab on market pages (currently empty)

**Migration plan**: Add ClickHouse query endpoints to the indexer API, then update frontend hooks to use them. The indexer already runs at `:3005` and has a proxy at `/api/indexer/`.

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| ~~SELL orders fail (no ERC-1155 approval)~~ | ~~HIGH~~ | DONE — implemented |
| ~~Data API schema changes break parsing~~ | ~~MEDIUM~~ | DONE — `.passthrough()` added |
| Limit orders rejected by CLOB | MEDIUM | Test with real limit orders, handle error messages |
| Non-neg-risk market signing fails | MEDIUM | Test a simple YES/NO binary market |
| Position data delayed after trade | LOW | Data API indexes from chain; may take 30-60s |
| WebSocket connection drops silently | LOW | Test real-time updates, add reconnection indicator |
| CLOB credentials expire mid-session | LOW | 401 handler already clears + triggers re-derivation |
| Gas price spike on Polygon | LOW | User pays ~$0.02/tx normally, spikes rare |

---

## Feature Backlog

### Sprint 7 — Portfolio Management (ON HOLD — needs ClickHouse)
- Resolved positions tab (query by resolved market IDs)
- Position redemption (`redeemPositions()` on CTF contract)
- Closed positions history
- Per-market P&L breakdown
- Portfolio value chart over time

### ~~Sprint 8 — Branding & SEO~~ DONE
- [x] Dynamic `generateMetadata()` per page (events/[id], market/[id] via layout, events, markets)
- [x] Open Graph / Twitter Cards (root + per-page, title template)
- [x] Sitemap + robots.txt (dynamic sitemap from indexer, robots blocks /api)
- [x] Structured data (JSON-LD Schema.org Event on event pages)
- [x] Custom not-found.tsx
- [x] SVG favicon with Neomarket branding

### ~~Sprint 9 — Real-time & Polish~~ PARTIAL
- [ ] Price flash animations on WebSocket updates
- [ ] Live orderbook depth chart
- [ ] Mobile-optimized trade panel
- [ ] New user onboarding flow
- [x] Loading skeleton screens (all routes)
- [x] Dialog component (Radix Dialog exported from UI package)

### ~~Sprint 10 — Performance & DevOps~~ PARTIAL
- [ ] Bundle analysis + code splitting
- [ ] E2E tests (Playwright)
- [x] CI pipeline (GitHub Actions: typecheck + build on push/PR)
- [x] ESLint configuration (next/core-web-vitals + next/typescript)
- [ ] Error monitoring (Sentry)

---

## Quick Wins (Can Do Anytime)

- [x] Rename PolyExplorer -> Neomarket in metadata/logo
- [x] Add `.passthrough()` to Data API Zod schemas
- [x] Add not-found.tsx page
- [x] Add error.tsx to remaining routes (events, portfolio, profile, markets)
- [x] Show market search results in NavSearch (parallel events + markets search)
- [ ] ~~Add Cmd+K shortcut for search~~ (skipped)
