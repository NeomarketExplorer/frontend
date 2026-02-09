# Neomarket Frontend

Next.js 15 trading frontend for Polymarket. Live at https://neomarket.bet.

## Architecture

```
Polymarket APIs                        Indexer API (138.201.57.139:3005)
  ├─ Gamma (markets/events)               ↑ separate repo, already running
  ├─ CLOB  (orderbook/trading)            │
  ├─ Data  (positions/activity)           │
  └─ WS    (real-time prices)             │
       ↓                                  ↓
  apps/web (Next.js :3000)  ←────────── this repo
       │
       ├─ /api/polymarket/sign   ← server-side HMAC signing (builder credentials)
       ├─ /api/clob/[...path]    ← proxy to CLOB API
       ├─ /api/gamma/[...path]   ← proxy to Gamma API
       └─ /api/indexer/[...path] ← proxy to Indexer
```

The indexer is a separate repo (`NeomarketExplorer/indexer`). This repo is frontend only.

## Quick Start

```bash
pnpm install
pnpm dev              # Next.js on :3000
```

The frontend talks to the production indexer by default. For local indexer dev, set
INDEXER_URL=http://localhost:3005 in apps/web/.env.local.

## Environment Variables

### Client-side (build-time, NEXT_PUBLIC_*)
```env
NEXT_PUBLIC_POLYMARKET_API_URL=https://gamma-api.polymarket.com
NEXT_PUBLIC_CLOB_API_URL=https://clob.polymarket.com
NEXT_PUBLIC_DATA_API_URL=https://data-api.polymarket.com
NEXT_PUBLIC_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws
NEXT_PUBLIC_CHAIN_ID=137
NEXT_PUBLIC_PRIVY_APP_ID=              # from https://dashboard.privy.io
```

### Server-side only (runtime, NEVER expose to client)
```env
INDEXER_URL=http://138.201.57.139:3005
POLYMARKET_API_KEY=                    # Builder Program API key
POLYMARKET_API_SECRET=                 # Builder Program secret (base64)
POLYMARKET_PASSPHRASE=                 # Builder Program passphrase
```

Builder credentials come from https://polymarket.com/settings?tab=builder after
Builder Program approval. They are used server-side only in `/api/polymarket/sign`
to generate HMAC-SHA256 signatures for order attribution. They must NEVER be
NEXT_PUBLIC_ or sent to the browser.

## Builder Program — How Credentials Flow

**Reference implementation:** https://github.com/Polymarket/privy-safe-builder-example
(This uses the exact same stack: Privy + Safe + Builder)

### Builder attribution (server-side HMAC)
```
1. Client sends { method, path, body } to /api/polymarket/sign
2. Server builds message: timestamp + method + requestPath + body
3. Server decodes POLYMARKET_API_SECRET from base64 → raw key
4. Server computes HMAC-SHA256(key, message) → URL-safe base64 signature
5. Server returns headers:
   - POLY_BUILDER_SIGNATURE: the HMAC signature
   - POLY_BUILDER_TIMESTAMP: unix timestamp (seconds, as integer)
   - POLY_BUILDER_API_KEY: from POLYMARKET_API_KEY env
   - POLY_BUILDER_PASSPHRASE: from POLYMARKET_PASSPHRASE env
6. Client attaches these headers alongside L2 headers when posting orders
```

### Per-user CLOB credentials (L1 → L2 auth)
```
1. User connects wallet (Privy embedded EOA)
2. Client signs EIP-712 ClobAuthDomain message (L1 auth):
   - Domain: { name: "ClobAuthDomain", version: "1", chainId: 137 }
     (NO verifyingContract field)
   - Type: ClobAuth [
       { name: "address", type: "address" },
       { name: "timestamp", type: "string" },
       { name: "nonce", type: "uint256" },
       { name: "message", type: "string" }
     ]
   - Message: { address, timestamp, nonce: 0, message: "This message attests that I control the given wallet" }
   - Timestamp is unix seconds (Math.floor(Date.now()/1000))
3. Build L1 headers: POLY_ADDRESS, POLY_SIGNATURE, POLY_TIMESTAMP, POLY_NONCE
4. Call GET /auth/derive-api-key with L1 headers (returning user)
   - If fails (new user), call POST /auth/api-key with L1 headers
   - Both return: { apiKey, secret, passphrase }
5. Store L2 credentials in Zustand (memory only, never localStorage)
6. On wallet disconnect/change → clear L2 credentials, re-derive on reconnect
```

### L2 request signing (per-user HMAC for authenticated CLOB calls)
```
1. Build message: timestamp + method + requestPath + body (if any)
2. Decode user's secret from base64
3. HMAC-SHA256(secret, message) → URL-safe base64
4. Headers: POLY_ADDRESS, POLY_SIGNATURE, POLY_TIMESTAMP, POLY_API_KEY, POLY_PASSPHRASE
```

### Full order submission flow
```
1. Validate order params (price 1-99, size > 0)
2. Build EIP-712 Order struct (domain: "Polymarket CTF Exchange", chain 137,
   verifyingContract: 0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E)
3. Sign Order with Privy useSignTypedData (silent for embedded wallets)
4. Build POST /order body: { order: signedOrder, owner: apiKey, orderType: "GTC" }
5. Generate L2 headers (user's HMAC for POST /order with body)
6. Call /api/polymarket/sign for builder headers (same method/path/body)
7. Merge L2 headers + builder headers
8. POST to /api/clob/order (proxy to CLOB)
9. Response: { success, orderId, orderHashes, errorMsg }
```

### /api/polymarket/sign endpoint spec
```
Route:    POST /api/polymarket/sign
Runtime:  Node.js (NOT Edge — needs crypto.subtle + raw body access)
Receives: { method: string, path: string, body: object }
Returns:  { POLY_BUILDER_SIGNATURE, POLY_BUILDER_TIMESTAMP, POLY_BUILDER_API_KEY, POLY_BUILDER_PASSPHRASE }

Guardrails:
- Validate origin (allowlist: neomarket.bet, localhost:3000)
- Max request size: 10KB
- Rate limit: 60 requests/min per IP (basic, via headers)
- Timestamp uses unix seconds (Math.floor(Date.now()/1000))
- Return 500 if builder credentials not configured
- Return 400 if method/path missing
- Body must be serialized to canonical JSON (JSON.stringify, no re-ordering)
```

### CLOB endpoints used in Sprint 5-6
```
# All client-side trading/auth/balance calls go through /api/clob to avoid CORS issues.
# Auth (L1 headers)
POST /auth/api-key           # Create new user API credentials
GET  /auth/derive-api-key    # Derive existing credentials (use first, fallback to create)

# Orders (L2 headers + builder headers)
POST   /order                # Place single order
DELETE /order/{id}           # Cancel single order
POST   /cancel-all           # Cancel all orders (optional)

# Open orders (L2 headers)
GET /data/orders             # Get active orders (?market=&asset_id=&id=)
GET /data/order/{id}         # Get single order by ID

# Balance (L2 headers)
GET /balance-allowance       # Check USDC balance + token allowance (?signature_type=0)

Note: CLOB balance may differ from on-chain wallet balance. UI shows wallet balance
and on-chain allowance as fallbacks (even before L2 creds exist) so users aren’t
blocked after approval. Orders still use CLOB auth and can fail if CLOB rejects.

# Read-only (no auth)
GET /book                    # Orderbook (?token_id=)
GET /midpoint                # Mid price (?token_id=)
GET /prices-history          # Price history
GET /trades                  # Recent trades
```

## Wallet & Signing Architecture

**Privy v1.99.1** handles wallet connection (embedded EOA + external wallets like MetaMask).
**wagmi v2.19.5** (plain, NOT `@privy-io/wagmi`) handles on-chain reads and contract writes.

Provider tree in `layout.tsx`:
```
PrivyProvider > QueryProvider > WagmiProvider > ClobAuthProvider > ...content
```

### Signing
- Embedded wallets (Privy): use `useSignTypedData` from `@privy-io/react-auth` — silent, no popup
- External wallets (MetaMask, Rabby, WalletConnect): use `wallet.getEthereumProvider()` + viem `walletClient.signTypedData()` — shows popup
- Wallet type check: `wallet.walletClientType === 'privy'` distinguishes embedded vs external
- Privy v1 signature: `signTypedData(typedData, uiOptions?, address?) => Promise<string>`
- Privy's `MessageTypes` requires **mutable** arrays — spread `as const` types: `{ Order: [...p.types.Order] }`
- CLOB credential derivation must wait for `useWallets().ready && wallets.length > 0`

### On-chain reads
- All contract reads use wagmi's `usePublicClient()` hook — no manual `createPublicClient` singletons
- Used in: `use-balance.ts`, `use-orders.ts` (post-order polling), `use-token-approval.ts`, `use-conditional-token-approval.ts`, `use-conditional-token-balance.ts`

### Contract writes (approvals)
- Token approvals use Privy's `useWallets` to get the provider, then viem `createWalletClient({ transport: custom(provider) })`
- wagmi's `useWriteContract` does NOT work without `@privy-io/wagmi` (no connected account in wagmi)
- Used in: `use-token-approval.ts` (USDC), `use-conditional-token-approval.ts` (ERC-1155)
- Single "Enable Trading" button (`use-enable-trading.ts`) batches USDC + CTF approvals

### Supported wallets
- Privy embedded wallets (email, Google, Twitter login → auto-created EOA)
- MetaMask, WalletConnect, Coinbase Wallet, and other injected wallets via Privy's external wallet connect

## Two-Repo Mental Model

The only contract between the two repos is the HTTP API. The indexer serves JSON at :3005, the
frontend consumes it. They share no code at runtime.

1. Frontend work (95% of the time): Work here. The indexer is running on the server. Push here,
   deploy here.
2. Indexer work (rare): If you need a new API endpoint, work in NeomarketExplorer/indexer,
   push, redeploy on Coolify. Then update the frontend to call it.
3. Shared types: packages/api exists in both repos. Types rarely change. The frontend has its
   own IndexerEvent/IndexerMarket types in lib/indexer.ts.

## Deployment

Already deployed on Coolify. Push to main and redeploy from Coolify dashboard.

- Server: Hetzner at 138.201.57.139
- Coolify: http://138.201.57.139:8000 (login: sergejxavi@gmail.com)
- Domain: neomarket.bet
- Indexer API: http://138.201.57.139:3005
- Build variable: NEXT_PUBLIC_PRIVY_APP_ID (set in Coolify, build-time only)
- Runtime variables: INDEXER_URL, POLYMARKET_API_KEY, POLYMARKET_API_SECRET, POLYMARKET_PASSPHRASE

## Key Files

| File | Purpose |
|------|---------|
| apps/web/src/app/layout.tsx | Root layout with NavSearch in header |
| apps/web/src/components/nav-search.tsx | Header search dropdown |
| apps/web/src/components/event-search.tsx | Page-level search (events page) |
| apps/web/src/components/connect-button.tsx | Wallet button with Privy gate |
| apps/web/src/lib/indexer.ts | Indexer API client (all frontend ↔ indexer calls) |
| apps/web/src/providers/privy-provider.tsx | Privy setup + usePrivyAvailable context |
| apps/web/src/providers/wagmi-provider.tsx | wagmi WagmiProvider wrapper (client component) |
| apps/web/src/lib/wagmi-config.ts | wagmi config (Polygon chain, SSR) |
| apps/web/src/hooks/use-auth.ts | Auth hooks (only inside Privy-gated components) |
| apps/web/src/hooks/use-orders.ts | Order placement hook (usePlaceOrder, useOpenOrders) |
| apps/web/src/hooks/use-enable-trading.ts | Batched USDC + CTF approval flow (single "Enable Trading" button) |
| apps/web/src/stores/wallet-store.ts | Zustand wallet state (balance, connection) |
| apps/web/src/app/market/[id]/page.tsx | Market page with chart + TradePanel |
| apps/web/src/app/events/[id]/page.tsx | Event detail with price bars |
| apps/web/src/components/home-events.tsx | Homepage trending events |
| apps/web/src/app/globals.css | Full design system (CSS variables) |
| apps/web/Dockerfile | Standalone Next.js (NEXT_PUBLIC_PRIVY_APP_ID as build arg) |
| packages/api/src/clob/index.ts | CLOB API client (orderbook, midpoint, trades) |
| packages/api/src/gamma/index.ts | Gamma API client (markets, events) |
| packages/api/src/data/index.ts | Data API client (positions, activity) |
| packages/api/src/websocket/index.ts | WebSocket manager (real-time orderbook) |
| packages/trading/src/orders.ts | EIP-712 order struct + signing types |
| packages/trading/src/signing.ts | Order signing (wallet-agnostic SignTypedDataFn) |
| packages/trading/src/calculations.ts | Trade math (cost, return, P&L) |
| packages/config/src/env.ts | Zod env schema (client + server vars) |
| packages/config/src/index.ts | Chain config, contract addresses |

## Repo Structure

```
neomarket-frontend/
├── apps/web/                  # Next.js 15 app
│   ├── src/app/               # Pages (/, /events, /markets, /market/[id], /portfolio, /profile)
│   ├── src/app/api/           # Proxy routes (clob, gamma, indexer)
│   ├── src/components/        # UI components
│   ├── src/hooks/             # React hooks (orders, auth, websocket)
│   ├── src/stores/            # Zustand stores (wallet, trading, ui)
│   ├── src/lib/               # Indexer client, utils
│   └── src/providers/         # Privy + wagmi providers
├── packages/api/              # Polymarket API clients (CLOB, Gamma, Data, WebSocket)
├── packages/trading/          # Trade logic, order signing, calculations
├── packages/ui/               # Radix UI components (Button, Card, Tabs, etc.)
├── packages/config/           # Env schema, chain config, contract addresses
├── docker-compose.yml         # Web only (INDEXER_URL env var)
├── turbo.json
└── pnpm-workspace.yaml
```

## Contract Addresses (Polygon, Chain ID 137)

| Contract | Address |
|----------|---------|
| USDC | 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 |
| CTF (Conditional Token Framework) | 0x4D97DCd97eC945f40cF65F87097ACe5EA0476045 |
| CTF Exchange | 0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E |

## Indexer API Reference

The indexer at :3005 provides these endpoints (consumed via lib/indexer.ts):

```
GET /health              # Health check
GET /stats               # Counts, volume, categories
GET /events              # ?limit=&offset=&search=&active=&closed=&sort=&order=
GET /events/:id          # Event detail with nested markets
GET /markets             # ?limit=&offset=&search=&active=&closed=&category=&sort=&order=
GET /markets/:id         # Market detail
GET /markets/:id/history # ?interval=1h|6h|1d|1w|max
GET /markets/:id/trades  # ?limit=
GET /markets/search      # ?q=&limit=
```

## Polymarket API Reference

Used via packages/api clients + proxy routes:

```
# Gamma API (gamma-api.polymarket.com) — market discovery
GET /markets             # ?limit=&offset=&active=&closed=&slug=&tag=
GET /events              # ?limit=&offset=&active=&closed=&slug=&tag=

# CLOB API (clob.polymarket.com) — trading
GET  /book               # ?token_id=  (orderbook)
GET  /midpoint            # ?token_id=  (mid price)
GET  /trades              # ?token_id=&limit=
GET  /prices-history      # ?token_id=&interval=&fidelity=
POST /auth/api-key        # L1 auth → create user API credentials
GET  /auth/derive-api-key # L1 auth → derive existing credentials
GET  /auth/nonce          # Get signing nonce
POST /order               # Submit signed order (L2 auth + builder headers)
DELETE /order/:id         # Cancel order (L2 auth)

# Data API (data-api.polymarket.com) — user data
GET /positions            # ?user=&sizeThreshold=
GET /activity             # ?user=&limit=&offset=

# WebSocket (ws-subscriptions-clob.polymarket.com/ws) — real-time
subscribe: book, last_trade_price, price_change, tick_size_change
```

## What's Done

- Events/markets/portfolio/profile pages
- Interactive header search (NavSearch) with dropdown
- Market page with chart (Lightweight Charts), orderbook, trade panel
- Homepage with stats, trending events, infinite scroll
- Privy wallet auth (embedded + external wallets, graceful degradation without app ID)
- wagmi integration for on-chain reads (`usePublicClient`); contract writes use Privy wallet provider + viem
- Silent EIP-712 signing via Privy `useSignTypedData` (zero popups for embedded wallets)
- WebSocket manager with real-time orderbook updates
- EIP-712 order struct and signing
- Trade calculations (cost, return, P&L)
- Portfolio with positions and activity tabs
- CLOB L1/L2 auth + builder attribution flow (L1 signing is silent for embedded wallets)
- Order submission with L2 + builder headers
- USDC balance + allowance fetch (CLOB /balance-allowance) with on-chain fallback display
- USDC + CTF/ERC-1155 approval flow (single "Enable Trading" button batches all approvals)
- Neg-risk exchange + conditional token (ERC-1155) approvals for SELL orders
- Toast notifications (Toaster)
- Terminal/hacker design aesthetic (JetBrains Mono, cyan accent, glass cards)
- Deployed to Coolify at neomarket.bet
- Open orders tab on market page (with cancel buttons)
- Order cancellation via CLOB DELETE /order/{id}
- Orderbook/trades error + empty state feedback (resolved/illiquid markets show "No orderbook data")
- Error boundaries (`error.tsx` at app root and per-route)
- Balance auto-refresh (30s polling + immediate invalidation after trades/approvals)
- Transaction confirmation UI (status banner: submitting → confirmed, auto-clear after 5s)
- Mobile optimization (responsive charts, touch-friendly trade panel, collapsible sections)
- Dynamic metadata (`generateMetadata()` on market, event, events, markets pages)
- Open Graph + Twitter Cards (per-page OG images, descriptions, Twitter card meta)
- Sitemap + robots.txt (dynamic `sitemap.ts` from indexer, `robots.ts`)
- Custom not-found page (terminal-aesthetic 404 with glass-card)
- Resolved/closed positions tab in portfolio (entry price, resolution price, realized P&L)
- P&L breakdown (cost basis, current value, unrealized gain/loss per position)
- Portfolio value chart (Lightweight Charts AreaSeries, cumulative from trade activity)
- Price flash animations (green/red flash on orderbook + midpoint price changes)
- Skeleton loading screens (homepage cards, orderbook, trades, orders, chart, portfolio)

## What's Not Working Yet

- (Nothing critical — all core trading flows work)

---

## Sprint Plan

### Sprint 5 — Trading Infrastructure (Builder Program)

**Goal:** Make the "Place Order" button actually work end-to-end with builder attribution.

This is the critical path. Nothing else matters if users can't trade.

**Reference:** https://github.com/Polymarket/privy-safe-builder-example (same stack: Privy + Safe)
**SDK:** `@polymarket/builder-signing-sdk` (for `buildHmacSignature`)
**SDK:** `@polymarket/clob-client` (for reference, but we implement our own thin client)

| # | Task | Details |
|---|------|---------|
| 5.1 | ~~Server-side signing endpoint~~ | **DONE** — `apps/web/src/app/api/polymarket/sign/route.ts` |
| 5.2 | ~~L1 authentication flow~~ | **DONE** — EIP-712 ClobAuth signing in `ClobAuthProvider` |
| 5.3 | ~~L2 credential derivation~~ | **DONE** — derive-api-key with fallback to create, stored in Zustand |
| 5.4 | ~~Implement order signing~~ | **DONE** — `packages/trading/src/signing.ts` |
| 5.5 | ~~Wire up order submission~~ | **DONE** — `usePlaceOrder` with L2 + builder headers |
| 5.6 | ~~USDC balance + allowance~~ | **DONE** — CLOB balance-allowance + on-chain fallback |
| 5.7 | ~~Token approval flow~~ | **DONE** — Single "Enable Trading" button batches USDC + CTF + neg-risk approvals |
| 5.8 | ~~Gnosis Safe deployment~~ | **DROPPED** — Not needed. EOA trading works, Polygon gas is fractions of a cent. |

**Env vars already set in Coolify:** `POLYMARKET_API_KEY`, `POLYMARKET_API_SECRET`, `POLYMARKET_PASSPHRASE`

**Known issues in current code to fix:**
- (All resolved)

---

### Sprint 6 — Order Management & User Feedback

**Goal:** Users can see, manage, and get feedback on their orders.

| # | Task | Details |
|---|------|---------|
| 6.1 | ~~Toast notification system~~ | **DONE** — using `toast()` from ui package. Toasts for: order placed, order failed, cancel success/failure, approval confirmed. |
| 6.2 | ~~Open orders display~~ | **DONE** — Orders tab on market page shows open orders with side, price, size, filled, time. Uses `useOpenOrders()` hook. |
| 6.3 | ~~Order cancellation~~ | **DONE** — Cancel button per order in Orders tab. Calls `useCancelOrder` → `DELETE /order/{id}` with L2 auth. Toast on success/failure. |
| 6.4 | ~~Error boundaries~~ | **DONE** — `error.tsx` at app root and per-route with terminal-aesthetic error UI |
| 6.5 | ~~Transaction confirmation UI~~ | **DONE** — Status banner (submitting → confirmed) with 5s auto-clear, auto-refresh positions |
| 6.6 | ~~Balance auto-refresh~~ | **DONE** — 30s polling + immediate invalidation after trades/approvals, optimistic UI updates |

---

### Sprint 7 — Portfolio & Position Management

**Goal:** Portfolio becomes a real management tool, not just a display.

| # | Task | Details |
|---|------|---------|
| 7.1 | ~~Resolved positions tab~~ | **DONE** — Open/Resolved sub-tabs, resolved positions with entry price, resolution price, Won/Lost badge |
| 7.2 | Position redemption | Call CTF contract `redeemPositions()` for resolved winning positions. Show "Claim" button with estimated payout. Toast on success. |
| 7.3 | ~~Closed positions history~~ | **DONE** — Merged into resolved tab with realized P&L, market outcome |
| 7.4 | ~~P&L breakdown~~ | **DONE** — Cost basis, current value, unrealized gain/loss per position in open positions table |
| 7.5 | ~~Portfolio value chart~~ | **DONE** — `portfolio-chart.tsx` using Lightweight Charts AreaSeries, cumulative from trade activity |

---

### Sprint 8 — Branding & SEO

**Goal:** Fix identity, become discoverable.

| # | Task | Details |
|---|------|---------|
| 8.1 | ~~Rebrand to Neomarket~~ | **DONE** — All metadata, titles, components use "Neomarket". OG tags set. |
| 8.2 | ~~Dynamic page metadata~~ | **DONE** — `generateMetadata()` on market/event/events/markets pages with truncated descriptions |
| 8.3 | ~~Open Graph + Twitter Cards~~ | **DONE** — Per-page OG type/url/images, Twitter cards with market images |
| 8.4 | ~~Sitemap + robots.txt~~ | **DONE** — Dynamic `sitemap.ts` from indexer events/markets, `robots.ts` |
| 8.5 | ~~Custom not-found page~~ | **DONE** — Terminal-aesthetic 404 with glass-card, colored dots, animated prompt |
| 8.6 | Structured data | JSON-LD for events (Schema.org Event type). Helps search engines understand market content. |

---

### Sprint 9 — Real-time & Polish

**Goal:** Make it feel alive and production-grade.

| # | Task | Details |
|---|------|---------|
| 9.1 | ~~Price flash animations~~ | **DONE** — Green/red flash on orderbook rows + midpoint text glow via CSS animations + React key re-trigger |
| 9.2 | Live orderbook depth | Visual depth chart alongside the orderbook. Real-time updates via existing WebSocket subscription. |
| 9.3 | ~~Mobile optimization~~ | **DONE** — Responsive charts, touch-friendly trade panel, collapsible sections, mobile search |
| 9.4 | New user onboarding | First-time flow: connect wallet → show balance → guide to first trade. Dismissable, not blocking. |
| 9.5 | ~~Loading/error polish~~ | **DONE** — Skeleton screens for homepage cards, orderbook, trades, orders, chart, portfolio tabs |
| 9.6 | Modal/dialog component | Build reusable dialog (Radix Dialog). Use for: order confirmation, approval prompt, position details, settings. |

---

### Sprint 10 — Performance & DevOps

**Goal:** Ship faster, load faster.

| # | Task | Details |
|---|------|---------|
| 10.1 | Bundle analysis | Run `@next/bundle-analyzer`. Identify large dependencies. Lazy-load charts, trading package. |
| 10.2 | Image optimization | Audit all market/event images. Use Next.js Image with proper sizing. Add blur placeholders. |
| 10.3 | API response caching | Tune React Query stale times. Add ISR for event/market pages. Cache indexer responses at proxy layer. |
| 10.4 | E2E tests | Playwright tests for critical paths: browse markets, connect wallet, place order, view portfolio. |
| 10.5 | CI pipeline | GitHub Actions: lint, type-check, build, e2e tests on PR. Block merge on failure. |
| 10.6 | Error monitoring | Sentry or similar. Capture client errors, API failures, wallet signing errors. Alert on spikes. |

---

## Priority Order

```
Sprint 5  (Trading Infrastructure)  ← CRITICAL PATH — do this first
Sprint 6  (Order Management)        ← users need feedback
Sprint 7  (Portfolio)               ← complete the trading loop
Sprint 8  (Branding & SEO)          ← growth & discoverability
Sprint 9  (Real-time & Polish)      ← delight
Sprint 10 (Performance & DevOps)    ← sustainability
```

Sprint 5 is the only blocker. Sprints 6-7 depend on it. Sprints 8-10 are independent
and can be parallelized or reordered.

---

## Search Improvement Plan

### Current State

- **NavSearch** (`nav-search.tsx`): Header dropdown, searches events only via `getEvents()`, 6 results max, 200ms debounce, keyboard nav (arrows + enter + escape). Works on mobile (responsive).
- **EventSearch** (`event-search.tsx`): Full-width on `/events` page, events only, 8 results max, shows volume + liquidity. Works on mobile.
- **searchMarkets()** in `lib/indexer.ts`: Exists, calls `/markets/search?q=`, but **nothing in the UI uses it**.
- **Markets page**: No search at all.

### Problems

1. No market search — users can only find events, not individual markets
2. No combined search — can't search events and markets in one place
3. ~~Nav search hidden on mobile~~ — **FIXED** (mobile optimization pass)
4. Results show no prices or outcome odds
5. Always sorted by volume — no relevance ranking
6. No Cmd+K / global keyboard shortcut
7. No recent or trending searches

### Target Design

The nav search dropdown should show **two separated sections**:

```
┌─────────────────────────────────┐
│ 🔍 Search markets & events...  │
├─────────────────────────────────┤
│ EVENTS                          │
│  ┌──┐ US Presidential Election  │
│  └──┘ $2.4M vol · Live         │
│  ┌──┐ Fed Interest Rate March   │
│  └──┘ $890K vol · Live         │
├─────────────────────────────────┤
│ MARKETS                         │
│  Will Trump win 2024?  YES 62¢  │
│  Fed rate cut March?   YES 34¢  │
│  Bitcoin > $100K?      YES 71¢  │
├─────────────────────────────────┤
│ View all results →              │
└─────────────────────────────────┘
```

### Implementation Tasks

| # | Task | Details |
|---|------|---------|
| S.1 | Parallel search API calls | NavSearch fires `getEvents()` and `searchMarkets()` in parallel on keystroke. Both use same debounced query. |
| S.2 | Grouped dropdown results | Two sections in dropdown: "Events" (top, with images/volume/status) and "Markets" (bottom, with outcome prices as YES/NO percentages). |
| S.3 | Market results with prices | Each market result shows: question, current YES price (from indexer or CLOB midpoint), live/resolved badge. Links to `/market/[id]`. |
| S.4 | Mobile search | Show search icon in mobile header. Tapping opens full-screen search overlay (not a tiny dropdown). Same grouped results. |
| S.5 | Cmd+K shortcut | Global keyboard listener. Opens/focuses nav search from anywhere. Show "⌘K" hint in search input placeholder. |
| S.6 | Relevance improvements | If indexer supports it, prefer title-match relevance over pure volume sort. Otherwise, do client-side: exact title matches first, then partial, then volume-sorted remainder. |
| S.7 | Markets page search | Add search input to `/markets` page (same pattern as EventSearch but calling `searchMarkets()`). |

These tasks are independent of Sprint 5 and can be done anytime.

---

## Don't

- Don't set NEXT_PUBLIC_* as runtime env vars — they must be build-time
- Don't expose builder credentials to the client — server-side only via /api/polymarket/sign
- Don't call useAuth/usePrivy/useWallets outside of Privy-gated components
- Don't install `@privy-io/wagmi` — no version supports both Privy v1.x AND React 19. Use plain `wagmi` instead
- Don't use wagmi's `useWriteContract` for transactions — wagmi has no connected account without `@privy-io/wagmi`. Use Privy's `useWallets` + viem `createWalletClient` for writes
- Don't use raw `provider.request({ method: 'eth_signTypedData_v4' })` — use Privy's `useSignTypedData` for silent embedded wallet signing
- Don't create `publicClient` singletons with `createPublicClient` — use wagmi's `usePublicClient` hook
- Don't forget node-linker=hoisted in the web Dockerfile
- Don't use CMD-SHELL in Docker health checks — use CMD array format
- Don't hardcode the indexer URL — use INDEXER_URL env var
- Don't store user L2 credentials in localStorage — memory only (Zustand)

## Do

- Test pnpm build before pushing
- Keep the terminal aesthetic (monospace, green accent, glass cards)
- Check lib/indexer.ts for available API calls before writing new ones
- Use the Polymarket magic-safe-builder-example as reference for builder integration
- Validate all env vars at startup via packages/config/src/env.ts
- Handle wallet disconnects gracefully — clear L2 credentials, reset balance
