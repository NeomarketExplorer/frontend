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

## Sprint 6 — Order Management: COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Toast notifications | DONE | Radix UI Toast, success/error variants |
| 6.2 | Open orders display | DONE | Orders tab on market page + portfolio page |
| 6.3 | Order cancellation UI | DONE | Cancel button per order, confirmation on portfolio |
| 6.4 | Error boundaries | DONE | All routes have error.tsx |
| 6.5 | Transaction confirmation UI | DONE | Status progression: signing → submitting → placed |
| 6.6 | Balance auto-refresh | DONE | 30s interval, invalidates after trades + 3s delayed position refresh |

## Sprint 7 — Portfolio Management: ON HOLD

Waiting for ClickHouse database setup. See NEXT-STEPS.md for details.

## Sprint 8 — Branding & SEO: COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8.1 | Rebrand to Neomarket | DONE | Metadata, logo, favicon |
| 8.2 | Dynamic page metadata | DONE | generateMetadata on events/[id], market/[id] (via layout), events, markets |
| 8.3 | Open Graph + Twitter Cards | DONE | Root + per-page OG tags, title template `%s \| Neomarket` |
| 8.4 | Sitemap + robots.txt | DONE | Dynamic sitemap from indexer, robots blocks /api + auth pages |
| 8.5 | Custom not-found.tsx | DONE | Terminal-themed 404 page |
| 8.6 | Structured data | DONE | JSON-LD Schema.org Event on event detail pages |

## Sprint 9 — Real-time & Polish: PARTIAL

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9.1 | Price flash animations | NOT STARTED | WebSocket hook exists, needs UI integration |
| 9.2 | Orderbook depth chart | NOT STARTED | |
| 9.3 | Mobile optimization | NOT STARTED | NavSearch hidden on mobile, trade panel needs work |
| 9.4 | User onboarding | NOT STARTED | |
| 9.5 | Loading skeletons | DONE | All routes have loading.tsx |
| 9.6 | Dialog component | DONE | Radix Dialog exported from UI package |

## Sprint 10 — Performance & DevOps: PARTIAL

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10.1 | Bundle analysis | NOT STARTED | |
| 10.2 | Image optimization | NOT STARTED | Some images use `unoptimized` flag |
| 10.3 | API caching | NOT STARTED | |
| 10.4 | E2E tests | NOT STARTED | Playwright configured but no tests written |
| 10.5 | CI pipeline | DONE | GitHub Actions: typecheck + build on push/PR |
| 10.6 | ESLint | DONE | next/core-web-vitals + next/typescript |
| 10.7 | Error monitoring | NOT STARTED | Sentry not yet integrated |

## What Works (Confirmed)

- Wallet connection via Privy (embedded EOA)
- CLOB L1 → L2 credential derivation (auto on connect)
- Orderbook display with correct sort order
- Live CLOB midpoint prices on outcome buttons
- Market order with orderbook depth walking
- Limit order placement
- USDC approval for CTF Exchange, NegRiskCtfExchange, NegRiskAdapter
- ERC-1155 approval for SELL orders (CTF Exchange or NegRisk CTF Exchange)
- Builder attribution (server-side HMAC)
- Balance display (CLOB balance + on-chain fallback)
- BUY MAX button (with $0.50 USDC reserve) and SELL MAX button
- Position display in trade panel (shares, avg price, value, P&L)
- Open orders display + cancel on market page and portfolio page
- Order status progression (signing → submitting → placed)
- Price chart (Lightweight Charts)
- Events/markets browsing via indexer
- Header search (events + markets in parallel, grouped dropdown)
- Toast notifications
- Dynamic SEO metadata on event and market pages
- Sitemap + robots.txt
- Loading skeletons on all routes
- Error boundaries on all routes
- CI pipeline (typecheck + build)

## What's Untested / Needs Work

| Area | Risk | Details |
|------|------|---------|
| **Non-neg-risk markets** | MEDIUM | Regular CTF Exchange domain used but not tested end-to-end |
| **Limit orders** | MEDIUM | Code path exists, GTC order type sent, not tested on CLOB |
| **Trades tab** | LOW | CLOB `/trades` may require L2 auth; waiting for ClickHouse |
| **Mobile UX** | MEDIUM | NavSearch hidden on mobile, trade panel not optimized |
| **WebSocket updates** | LOW | Connection logic exists, price invalidation working |

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
  useMarketPositions(conditionId) hook
        |
        v
  Portfolio page / Market page position display
```

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
