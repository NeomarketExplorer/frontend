# Neomarket — Current Status

Last updated: 2026-02-01

## Sprint 5 — Trading Infrastructure: COMPLETE

All 7 tasks shipped and confirmed working on mainnet.

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 5.1 | Server-side signing (`/api/polymarket/sign`) | DONE | Builder HMAC working, orders attributed |
| 5.2 | L1 auth (EIP-712 ClobAuthDomain) | DONE | Credential derivation succeeds |
| 5.3 | L2 credential derivation | DONE | sessionStorage scoped by wallet |
| 5.4 | Order signing (EIP-712 Order struct) | DONE | Neg-risk + regular domains |
| 5.5 | Order submission (L2 + builder headers) | DONE | Confirmed on Polygonscan |
| 5.6 | USDC balance + allowance | DONE | CLOB + on-chain fallback, 30s refresh |
| 5.7 | Token approval (USDC -> exchanges) | DONE | Neg-risk: 2 TXs (Exchange + Adapter) |
| 5.8 | Gnosis Safe | DEFERRED | EOA trading works, users pay ~$0.02 gas |

**First confirmed trade**: `0x2815257396db7b60bb78217683eb3d9f1a6f407e1459cff27cb88b78cbd1fe9c`
- Market buy on neg-risk market
- 3.30 USDC paid, 17.37M conditional tokens received
- Routed through Neg Risk Fee Module 2

## Sprint 6 — Order Management: PARTIAL (3/6)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Toast notifications | DONE | Radix UI Toast, success/error variants |
| 6.2 | Open orders display | NOT STARTED | Hook exists (`useOpenOrders`), no UI |
| 6.3 | Order cancellation UI | NOT STARTED | Hook exists (`useCancelOrder`), no UI |
| 6.4 | Error boundaries | DONE | Root + market page error.tsx |
| 6.5 | Transaction confirmation UI | PARTIAL | Button pending state + toast only |
| 6.6 | Balance auto-refresh | DONE | 30s interval, invalidates after trades |

## What Works (Confirmed)

- Wallet connection via Privy (embedded EOA)
- CLOB L1 -> L2 credential derivation (auto on connect)
- Orderbook display with correct sort order
- Live CLOB midpoint prices on outcome buttons
- Market order with orderbook depth walking
- Limit order placement
- USDC approval for CTF Exchange, NegRiskCtfExchange, NegRiskAdapter
- Builder attribution (server-side HMAC)
- Balance display (CLOB balance + on-chain fallback)
- Price chart (Lightweight Charts)
- Events/markets browsing via indexer
- Header search (events only)
- Toast notifications

## What's Untested / Risky

| Area | Risk | Details |
|------|------|---------|
| **SELL orders** | HIGH | May need ERC-1155 `setApprovalForAll()` for conditional tokens. Not implemented. |
| **Non-neg-risk markets** | MEDIUM | Regular CTF Exchange domain used but never tested end-to-end. |
| **Limit orders** | MEDIUM | Code path exists, `GTC` order type sent. Not tested on CLOB. |
| **Portfolio page** | MEDIUM | Calls `data-api.polymarket.com` directly (CORS OK). Zod schemas lack `.passthrough()`. |
| **Trades tab** | LOW | CLOB `/trades` may require L2 auth; falls back to empty `[]`. |
| **WebSocket updates** | LOW | Connection logic exists, unclear if actually receiving data. |
| **Data API Zod schemas** | MEDIUM | No `.passthrough()` — extra fields from API will cause parse failures. |

## Known Bugs

1. ~~**Branding**: Root metadata says "PolyExplorer"~~ FIXED — now "Neomarket"
2. ~~**Logo**: Header says "POLYEXPLORER"~~ FIXED — now "NEOMARKET"
3. **No not-found.tsx**: 404s show default Next.js page
4. **Trades tab empty**: CLOB `/trades` likely needs L2 auth, hook catches error silently
5. **Market search unused**: `useSearchMarkets` hook exists, not wired to any UI
6. **Mobile search hidden**: NavSearch hidden on mobile viewports

## Architecture Notes

### Data Flow for Positions
```
Polymarket Data API (data-api.polymarket.com)
  GET /positions?user=ADDRESS
  GET /activity?user=ADDRESS
        |
        v (direct fetch, CORS: *)
  usePositions() hook
  useActivity() hook
  usePortfolio() hook
        |
        v
  Portfolio page / Market page position display
```

No proxy needed — Data API allows all origins. But adding `/api/data/` proxy
would improve consistency and enable server-side caching.

### Data Flow for Trading
```
Browser (Privy wallet)
  1. Sign EIP-712 Order struct
  2. Build POST body
  3. Generate L2 HMAC headers
  4. Call /api/polymarket/sign -> builder HMAC headers
  5. Merge headers
  6. POST /api/clob/order (proxy) or direct to CLOB
        |
        v
  CLOB API (clob.polymarket.com)
  -> Match against orderbook
  -> Settle on Polygon
```

### Contract Addresses (Polygon 137)
| Contract | Address | Used For |
|----------|---------|----------|
| USDC | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | Payment token |
| CTF | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` | ERC-1155 conditional tokens |
| CTF Exchange | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` | Regular binary markets |
| NegRisk CTF Exchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` | Multi-outcome markets |
| NegRisk Adapter | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` | Neg-risk position wrapping |
