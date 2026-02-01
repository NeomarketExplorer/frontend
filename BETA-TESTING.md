# Beta Testing Plan — Neomarket

## Overview

URL: https://neomarket.bet
Network: Polygon (chain ID 137)
Wallet: Any EVM wallet (Rabby, MetaMask, etc.) via Privy

**Prerequisites for testers:**
- Polygon wallet with some USDC.e (`0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`)
- Small amount of POL/MATIC for gas (~$0.10 is enough for dozens of transactions)
- Browser with wallet extension (Brave + Rabby recommended)

---

## Test Suite 1: Browse & Discover (No Wallet Needed)

These tests verify the read-only experience works.

### T1.1 — Homepage
- [ ] Homepage loads with trending events
- [ ] Stats bar shows total events, markets, volume
- [ ] Event cards show images, titles, volume
- [ ] Clicking an event navigates to `/events/[id]`
- [ ] Infinite scroll loads more events

### T1.2 — Events Page
- [ ] `/events` page loads with list of events
- [ ] Search box filters events by name
- [ ] Events show volume and liquidity
- [ ] Clicking event shows detail page with nested markets

### T1.3 — Market Page (Read Only)
- [ ] Navigate to any market (e.g., from an event page)
- [ ] Price chart loads and shows historical data
- [ ] Time interval buttons work (1H, 6H, 1D, 1W, MAX)
- [ ] Orderbook tab shows bids (green) and asks (red)
- [ ] Bids should be highest price first, asks lowest first
- [ ] Outcome buttons show live prices (e.g., "Yes 62c")
- [ ] Trade panel shows "Connect Wallet to Trade" or HTTPS warning

### T1.4 — Search
- [ ] Header search (desktop): type a query, dropdown shows event results
- [ ] Arrow keys navigate results, Enter selects
- [ ] Escape closes dropdown
- [ ] Results link to correct event pages

### T1.5 — Navigation
- [ ] All nav links work: Home, Events, Markets, Portfolio, Profile
- [ ] Portfolio and Profile show "Connect Wallet" prompt

---

## Test Suite 2: Wallet Connection

### T2.1 — Connect
- [ ] Click "Connect" button in header
- [ ] Privy modal appears with wallet options
- [ ] Select your wallet (e.g., Rabby, MetaMask)
- [ ] After connecting, header shows truncated address
- [ ] USDC balance appears in trade panel header

### T2.2 — Disconnect
- [ ] Click address/profile area to disconnect
- [ ] Balance disappears
- [ ] Trade panel reverts to "Connect Wallet" state
- [ ] Reconnecting should not require re-signing (credentials cached in session)

### T2.3 — CLOB Auth (Automatic)
- [ ] After connecting, you should NOT be prompted to sign anything immediately
- [ ] When you first interact with trading (open a market page while connected), credentials derive automatically
- [ ] Check browser console: no 401 errors after initial derivation
- [ ] If you see "CLOB credentials not available" error, something is wrong — report it

---

## Test Suite 3: Trading — BUY (Critical Path)

**Use a market with good liquidity (tight spread, visible bids/asks).**

### T3.1 — USDC Approval
- [ ] On market page, select an outcome (YES/NO)
- [ ] If this is your first trade, you should see "Approve USDC" button
- [ ] Click Approve — wallet should prompt for 1 or 2 approval transactions
  - For neg-risk (multi-outcome) markets: **2 approvals** (NegRiskCtfExchange + NegRiskAdapter)
  - For simple YES/NO markets: **1 approval** (CTF Exchange)
- [ ] After approval(s) confirm, button should change to "Buy Yes" / "Sell No" etc.
- [ ] **Report**: How many approval TXs were you prompted for? On what type of market?

### T3.2 — Market Buy
- [ ] Ensure "Market" tab is selected (not "Limit")
- [ ] Enter a small number of shares (e.g., 10)
- [ ] Best Ask price should show in the info box
- [ ] Est. Cost should show a reasonable dollar amount
- [ ] Click "Market Buy Yes" (or whatever the button says)
- [ ] Wallet should prompt to sign the order (EIP-712 typed data)
- [ ] After signing, button shows "Placing Order..."
- [ ] Success toast should appear with Order ID
- [ ] **Report**: Did the order go through? What was the toast message?

### T3.3 — Market Buy Verification
- [ ] After order placed, check Polygonscan for your address
- [ ] You should see the trade TX with USDC transferred and ERC-1155 tokens received
- [ ] USDC balance in trade panel should decrease
- [ ] **Report**: TX hash, amount paid, tokens received

### T3.4 — Limit Buy
- [ ] Switch to "Limit" tab
- [ ] Enter a price (in cents, e.g., 30 for 30c)
- [ ] Enter shares (e.g., 50)
- [ ] Est. Cost should equal price * shares / 100
- [ ] Click the buy button
- [ ] Sign the order
- [ ] Toast should confirm
- [ ] **Report**: Did limit order submit? What was the response?

---

## Test Suite 4: Position Display (New Feature)

### T4.1 — Market Page Position
- [ ] After buying shares, refresh the market page
- [ ] "Your Position" section should appear in the trade panel (above the action button)
- [ ] Shows: shares held, outcome label, avg entry price, current value, P&L
- [ ] **Report**: Does it show? Is the data accurate? Screenshot appreciated.

### T4.2 — SELL Mode Available Shares
- [ ] Click "Sell" button in trade panel
- [ ] Next to "Shares" input, you should see "Available: X.XX MAX"
- [ ] Click MAX — should fill the size input with your position size
- [ ] **Report**: Does MAX button appear? Does it fill correctly?

### T4.3 — Portfolio Page
- [ ] Navigate to `/portfolio`
- [ ] Should show 4 summary cards: Portfolio Value, Total P&L, Open Positions, Win Rate
- [ ] Positions tab should list your position(s)
- [ ] Each position shows outcome, condition ID, shares, avg price, current value, P&L
- [ ] Clicking a position links to the market page
- [ ] **Report**: Does the portfolio load? Are positions visible? Screenshot appreciated.

---

## Test Suite 5: SELL Orders (High Risk — May Fail)

**WARNING**: SELL orders may require ERC-1155 token approval which is NOT yet implemented.
If selling fails, that's expected and useful data.

### T5.1 — Attempt Market Sell
- [ ] On a market where you hold shares, click "Sell"
- [ ] Enter shares to sell (or click MAX)
- [ ] Click "Market Sell Yes"
- [ ] Sign the order
- [ ] **Report**: Did it work? What error message if it failed? Full error text please.

### T5.2 — Attempt Limit Sell
- [ ] Switch to Limit, enter price and shares
- [ ] Try to sell
- [ ] **Report**: Same as above — success or error message

---

## Test Suite 6: Edge Cases

### T6.1 — Insufficient Balance
- [ ] Try to buy more shares than your USDC balance allows
- [ ] "Insufficient balance" warning should appear
- [ ] Buy button should be disabled
- [ ] **Report**: Does the warning show correctly?

### T6.2 — No Liquidity
- [ ] Find a market with empty orderbook (no asks/bids)
- [ ] Try market buy — should show "No liquidity"
- [ ] Buy button should be disabled
- [ ] **Report**: Does it handle gracefully?

### T6.3 — Wallet Switch
- [ ] Connect with wallet A, place an order
- [ ] Disconnect, connect with wallet B
- [ ] Verify: balance updates, positions are different, no stale data from wallet A
- [ ] **Report**: Any issues with wallet switching?

### T6.4 — Page Refresh
- [ ] While connected, refresh the page
- [ ] Wallet should remain connected (Privy persists session)
- [ ] CLOB credentials should reload from sessionStorage
- [ ] No re-signing required
- [ ] **Report**: Smooth reconnect or issues?

---

## Reporting Template

When reporting issues, please include:

```
## Issue: [Short description]

**Test case**: T[X.Y]
**Market URL**: https://neomarket.bet/market/[id]
**Wallet**: [address, first 6 + last 4 chars]
**What happened**: [description]
**Expected**: [what should have happened]
**Console errors**: [if any, open DevTools > Console]
**Network errors**: [if any, open DevTools > Network, filter for failed requests]
**Screenshots**: [attach if possible]
**TX hash**: [if applicable]
```

---

## Priority Order for Testing

1. **T3 (BUY orders)** — Most critical, validates the core trading flow
2. **T4 (Position display)** — New feature, needs verification
3. **T5 (SELL orders)** — Expected to potentially fail, but need the error data
4. **T1 (Browse)** — Low risk, should work but good to verify
5. **T2 (Wallet)** — Mostly working, edge cases matter
6. **T6 (Edge cases)** — Important for robustness
