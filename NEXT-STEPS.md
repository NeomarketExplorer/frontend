# Next Steps — Priority Order

## Immediate Fixes (Before Beta Testers)

### ~~1. Data API Zod schemas need `.passthrough()`~~ DONE
Added `.passthrough()` to `PositionSchema` and `ActivitySchema` in `packages/api/src/data/index.ts`.

### 2. SELL orders need ERC-1155 approval
**Risk**: HIGH — users will try to sell their positions and get errors.
**What's needed**: Before selling conditional tokens, the user needs to call `setApprovalForAll(operator, true)` on the CTF contract (`0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`) for the relevant exchange:
- Regular markets: approve CTF Exchange (`0x4bFb41...`)
- Neg-risk markets: approve NegRisk CTF Exchange (`0xC5d563...`)

**Implementation**:
- Add `useConditionalTokenApproval(negRisk)` hook
- Check `isApprovedForAll(owner, operator)` on CTF contract
- If not approved, prompt user to send `setApprovalForAll` TX
- Gate SELL button on this approval
- Different from USDC approval — this is ERC-1155, not ERC-20

### ~~3. MAX button for BUY~~ DONE
Added BUY MAX button in market page trade panel. Calculates `Math.floor(effectiveBalance / (price / 100))` and fills shares input on click. Shows alongside the existing SELL MAX button (which fills position size).

### ~~4. Rebrand PolyExplorer -> Neomarket~~ DONE
Metadata title and header logo changed to "Neomarket" in `layout.tsx`.

---

## Sprint 6 Completion

### 5. Open Orders UI
**Hook**: `useOpenOrders({ market, assetId })` already implemented.
**Where to show**:
- Market page: tab alongside Orderbook/Trades, filtered by market's token IDs
- Portfolio page: new "Orders" tab showing all open orders
**Each order shows**: side, price, size, filled amount, created time, cancel button.

### 6. Order Cancellation UI
**Hook**: `useCancelOrder()` already implemented.
**Implementation**: Cancel button per order in the open orders list. Confirmation dialog before cancel. Toast on success/failure.

### 7. Transaction Confirmation Flow
**Current**: Button says "Placing Order..." then toast.
**Better**: Show order status progression:
1. "Sign order..." (waiting for wallet signature)
2. "Submitting..." (waiting for CLOB response)
3. "Order placed" (CLOB accepted)
4. Auto-refresh positions after a short delay

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
| SELL orders fail (no ERC-1155 approval) | HIGH | Implement before beta launch |
| Data API schema changes break parsing | MEDIUM | Add `.passthrough()` to Zod schemas |
| Limit orders rejected by CLOB | MEDIUM | Test with real limit orders, handle error messages |
| Non-neg-risk market signing fails | MEDIUM | Test a simple YES/NO binary market |
| Position data delayed after trade | LOW | Data API indexes from chain; may take 30-60s |
| WebSocket connection drops silently | LOW | Test real-time updates, add reconnection indicator |
| CLOB credentials expire mid-session | LOW | 401 handler already clears + triggers re-derivation |
| Gas price spike on Polygon | LOW | User pays ~$0.02/tx normally, spikes rare |

---

## Feature Backlog (Post Sprint 6)

### Sprint 7 — Portfolio Management
- Resolved positions tab (query by resolved market IDs)
- Position redemption (`redeemPositions()` on CTF contract)
- Closed positions history
- Per-market P&L breakdown
- Portfolio value chart over time

### Sprint 8 — Branding & SEO
- Dynamic `generateMetadata()` per page
- Open Graph / Twitter Cards
- Sitemap + robots.txt
- Structured data (JSON-LD)
- Custom not-found.tsx

### Sprint 9 — Real-time & Polish
- Price flash animations on WebSocket updates
- Live orderbook depth chart
- Mobile-optimized trade panel
- New user onboarding flow
- Loading skeleton screens

### Sprint 10 — Performance & DevOps
- Bundle analysis + code splitting
- E2E tests (Playwright)
- CI pipeline (lint, typecheck, build, test)
- Error monitoring (Sentry)

---

## Quick Wins (Can Do Anytime)

- [x] Rename PolyExplorer -> Neomarket in metadata/logo
- [x] Add `.passthrough()` to Data API Zod schemas
- [ ] Add not-found.tsx page
- [ ] Add error.tsx to remaining routes (events, portfolio, profile, markets)
- [ ] Show market search results in NavSearch (hook exists, just wire it)
- [ ] Add Cmd+K shortcut for search
