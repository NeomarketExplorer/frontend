# Neomarket — Current Status

Last updated: 2026-02-18

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

## Sprint 6 — Order Management: COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Toast notifications | DONE | Radix UI Toast, success/error variants |
| 6.2 | Open orders display | DONE | Orders tab on market page + portfolio page |
| 6.3 | Order cancellation UI | DONE | Cancel button per order, confirmation on portfolio |
| 6.4 | Error boundaries | DONE | All routes have error.tsx |
| 6.5 | Transaction confirmation UI | DONE | Status progression: signing → submitting → placed |
| 6.6 | Balance auto-refresh | DONE | 30s interval, invalidates after trades + 3s delayed position refresh |

## Sprint 7 — Portfolio Management: COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.1 | Resolved positions tab | DONE | Open/Resolved sub-tabs with entry price, resolution price, Won/Lost badge |
| 7.2 | Position redemption | DONE | `redeemPositions()` on CTF contract, "Claim" button with estimated payout |
| 7.3 | Closed positions history | DONE | Merged into resolved tab with realized P&L, market outcome |
| 7.4 | P&L breakdown | DONE | Cost basis, current value, unrealized gain/loss per position |
| 7.5 | Portfolio value chart | DONE | Lightweight Charts AreaSeries, cumulative from trade activity |

## Sprint 8 — Branding & SEO: COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8.1 | Rebrand to Neomarket | DONE | Metadata, logo, favicon |
| 8.2 | Dynamic page metadata | DONE | generateMetadata on events/[id], market/[id] (via layout), events, markets |
| 8.3 | Open Graph + Twitter Cards | DONE | Root + per-page OG tags, title template `%s \| Neomarket` |
| 8.4 | Sitemap + robots.txt | DONE | Dynamic sitemap from indexer, robots blocks /api + auth pages |
| 8.5 | Custom not-found.tsx | DONE | Terminal-themed 404 page |
| 8.6 | Structured data | DONE | JSON-LD Schema.org Event on event detail pages |

## Sprint 9 — Real-time & Polish: COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9.1 | Price flash animations | DONE | CSS keyframes (flash-positive/negative) + React key re-trigger on orderbook + midpoint |
| 9.2 | Orderbook depth chart | DONE | SVG depth visualization with List/Depth toggle, real-time via WebSocket |
| 9.3 | Mobile optimization | DONE | Responsive layouts, mobile search overlay, touch-friendly trade panel |
| 9.4 | User onboarding | SKIPPED | Intentionally dropped — platform should be self-explanatory |
| 9.5 | Loading skeletons | DONE | Skeleton screens on all routes (homepage, market, events, portfolio, profile) |
| 9.6 | Dialog component | DONE | Radix Dialog exported from UI package |

## Sprint 10 — Performance & DevOps: COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10.1 | Bundle analysis | DONE | @next/bundle-analyzer configured, lazy-load charts + trading package |
| 10.2 | Image optimization | DONE | All components use next/image with remote patterns configured |
| 10.3 | API caching | DONE | React Query staleTime/refetchInterval tuned by data volatility |
| 10.4 | E2E tests | DONE | Playwright: navigation, market, search, trading, homepage (5 test files) |
| 10.5 | CI pipeline | DONE | GitHub Actions: lint, type-check, unit tests, build + manual E2E job |
| 10.6 | Error monitoring | DONE | Sentry integration (client + server), captures in root error boundary |

## All Sprints Complete

**Sprints 5-10 shipped.** The frontend is feature-complete for v1.

## What Works (Confirmed)

- Wallet connection via Privy (embedded EOA + external wallets)
- CLOB L1 → L2 credential derivation (auto on connect)
- Orderbook display with correct sort order + depth chart toggle
- Live CLOB midpoint prices on outcome buttons with flash animations
- Market order with orderbook depth walking
- Limit order placement
- USDC approval for CTF Exchange, NegRiskCtfExchange, NegRiskAdapter
- ERC-1155 approval for SELL orders (CTF Exchange or NegRisk CTF Exchange)
- Builder attribution (server-side HMAC)
- Balance display (CLOB balance + on-chain fallback), 30s auto-refresh
- BUY MAX button (with $0.50 USDC reserve) and SELL MAX button
- Position display in trade panel (shares, avg price, value, P&L)
- Open orders display + cancel on market page and portfolio page
- Order status progression (signing → submitting → placed)
- Candlestick chart (OHLCV from ClickHouse) with volume histogram
- Events/markets browsing via indexer with category taxonomy
- Header search (events + markets in parallel, grouped dropdown, Cmd+K)
- Toast notifications
- Dynamic SEO metadata on event and market pages
- Sitemap + robots.txt + JSON-LD structured data
- Loading skeletons on all routes
- Error boundaries on all routes + Sentry error monitoring
- CI pipeline (lint + type-check + unit tests + build + E2E)
- Portfolio: open/resolved positions, P&L breakdown, value chart, redemption
- Mobile-responsive layout with touch-friendly trade panel

## What's Untested / Needs Work

| Area | Risk | Details |
|------|------|---------|
| **Non-neg-risk markets** | MEDIUM | Regular CTF Exchange domain used but not tested end-to-end |
| **Limit orders** | MEDIUM | Code path exists, GTC order type sent, not tested on CLOB |
| **Discovery feed** | LOW | ClickHouse `/discover/markets` may 404 until API redeploy + new CH tables/MVs |
| **WebSocket reconnection** | LOW | Connection logic exists, reconnection edge cases untested |

## Architecture Notes

### Data Flow for Positions
```
ClickHouse (via Next.js proxy: /api/clickhouse/...)
  GET /positions?user=ADDRESS
        |
        v
  usePositions() hook (ClickHouse preferred)
        |
        +-- fallback: Polymarket Data API GET /positions?user=ADDRESS
        |
        v
  Portfolio page / Market page position display (positions = outcome token shares; cash separate)
```

### Data Flow for Trading
```
Browser (Privy wallet)
  1. Sign EIP-712 Order struct
  2. Build POST body
  3. Generate L2 HMAC headers
  4. Call /api/polymarket/sign -> builder HMAC headers
  5. Merge headers
  6. POST direct to clob.polymarket.com/order (user's IP for geo-compliance)
        |
        v
  CLOB API (clob.polymarket.com)
  -> Match against orderbook
  -> Settle on Polygon
```

### Data Flow for Charts + Trades Panels
```
ClickHouse (via Next.js proxy: /api/clickhouse/...)
  GET /market/candles?conditionId=...&tokenId=...&interval=...
  GET /trades?tokenId=...&limit=...
        |
        v
  Market chart (candlestick + volume) + trades panels
```

### Contract Addresses (Polygon 137)
| Contract | Address | Used For |
|----------|---------|----------|
| USDC | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | Payment token |
| CTF | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` | ERC-1155 conditional tokens |
| CTF Exchange | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` | Regular binary markets |
| NegRisk CTF Exchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` | Multi-outcome markets |
| NegRisk Adapter | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` | Neg-risk position wrapping |
