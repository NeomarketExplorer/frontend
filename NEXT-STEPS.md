# Next Steps — Post v1

All sprints (5-10) are complete. The frontend is feature-complete for v1.

---

## Completed Milestones

### Sprint 5 — Trading Infrastructure: DONE
Server-side HMAC signing, L1/L2 auth, order signing + submission, USDC balance/allowance, token approvals.

### Sprint 6 — Order Management: DONE
Toast notifications, open orders display, order cancellation, error boundaries, tx confirmation UI, balance auto-refresh.

### Sprint 7 — Portfolio Management: DONE
Resolved positions tab, position redemption, closed positions, P&L breakdown, portfolio value chart.

### Sprint 8 — Branding & SEO: DONE
Rebrand to Neomarket, dynamic metadata, OG/Twitter cards, sitemap + robots.txt, structured data (JSON-LD), custom 404.

### Sprint 9 — Real-time & Polish: DONE
Price flash animations, orderbook depth chart, mobile optimization, skeleton loading, dialog component. (Onboarding skipped by design.)

### Sprint 10 — Performance & DevOps: DONE
Bundle analyzer + lazy loading, next/image optimization, React Query cache tuning, E2E tests (Playwright), CI pipeline (GitHub Actions), Sentry error monitoring.

---

## Data Sources — Current Architecture

```
# Markets/events/categories browsing (Postgres indexer)
Markets:    /api/indexer/...
Events:     /api/indexer/...
Categories: /api/indexer/...

# Discovery feed (ClickHouse) (expected 404 until ClickHouse API redeploy + tables/MVs exist)
Discovery:  /api/clickhouse/discover/markets?window=1h|6h|24h|7d&limit=&category=

# Positions (ClickHouse preferred, Data API fallback)
Positions:  /api/clickhouse/positions?user=ADDRESS
Fallback:   data-api.polymarket.com/positions?user=ADDRESS

# Charts + trades panels (ClickHouse)
Candles:    /api/clickhouse/market/candles?conditionId=...&tokenId=...&interval=...
Trades:     /api/clickhouse/trades?tokenId=...&limit=

# Trading (Polymarket CLOB — direct from browser for geo-compliance)
Orderbook:  clob.polymarket.com/book?token_id=TOKEN
Balance:    clob.polymarket.com/balance-allowance (L2 auth)
Orders:     clob.polymarket.com/order (L2 + builder headers)
```

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Non-neg-risk market signing fails | MEDIUM | Test a simple YES/NO binary market end-to-end |
| Limit orders rejected by CLOB | MEDIUM | Test with real limit orders, handle error messages |
| Discovery feed 404s | LOW | ClickHouse API needs redeploy + new tables/MVs + category sync |
| WebSocket reconnection edge cases | LOW | Connection logic exists, reconnection indicator could be added |
| CLOB credentials expire mid-session | LOW | 401 handler already clears + triggers re-derivation |

---

## Future Improvements (Post v1)

### UX Enhancements
- Copy trading / strategy following
- Advanced order types (stop-loss, take-profit)
- Push notifications for position updates
- Portfolio sharing / social features

### Infrastructure
- ClickHouse materialized views for faster candle queries (see CANDLE_PERF_FIX.md)
- Indexer `active` flag fix for 42K+ markets (see INDEXER_ACTIVE_FLAG_FIX.md)
- WebSocket reconnection indicator in UI
- Rate limiting on `/api/polymarket/sign` endpoint

### Data
- Historical P&L charts (requires ClickHouse ledger)
- Market correlation analysis
- Volume analytics dashboard
