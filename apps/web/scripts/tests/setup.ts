/**
 * Shared test setup: wallet, auth, market discovery, order helpers.
 * Every E2E test imports from here.
 */

import { createWalletClient, createPublicClient, http, type Hex, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Keeper positions — positions held for redemption testing, never sold by cleanup
// ---------------------------------------------------------------------------

const KEEPERS_FILE = path.resolve(__dirname, '../.keepers.json');

export interface KeeperEntry {
  tokenId: string;
  conditionId: string;
  question: string;
  size: number;
  price: number;
  boughtAt: string; // ISO date
}

export function loadKeepers(): KeeperEntry[] {
  try {
    if (fs.existsSync(KEEPERS_FILE)) {
      return JSON.parse(fs.readFileSync(KEEPERS_FILE, 'utf-8'));
    }
  } catch { /* corrupt file */ }
  return [];
}

export function saveKeepers(keepers: KeeperEntry[]) {
  fs.writeFileSync(KEEPERS_FILE, JSON.stringify(keepers, null, 2));
}

export function addKeeper(entry: KeeperEntry) {
  const keepers = loadKeepers();
  // Don't duplicate
  if (!keepers.some((k) => k.tokenId === entry.tokenId)) {
    keepers.push(entry);
    saveKeepers(keepers);
  }
}

export function getKeeperTokenIds(): Set<string> {
  return new Set(loadKeepers().map((k) => k.tokenId));
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const CLOB_BASE = 'https://clob.polymarket.com';
export const GAMMA_BASE = 'https://gamma-api.polymarket.com';

export const CLOB_AUTH_DOMAIN = {
  name: 'ClobAuthDomain' as const,
  version: '1' as const,
  chainId: 137,
};

export const CTF_EXCHANGE_DOMAIN = {
  name: 'Polymarket CTF Exchange' as const,
  version: '1' as const,
  chainId: 137,
  verifyingContract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as Hex,
};

export const NEG_RISK_CTF_EXCHANGE_DOMAIN = {
  name: 'Polymarket CTF Exchange' as const,
  version: '1' as const,
  chainId: 137,
  verifyingContract: '0xC5d563A36AE78145C45a50134d48A1215220f80a' as Hex,
};

const CLOB_AUTH_TYPES = {
  ClobAuth: [
    { name: 'address', type: 'address' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'message', type: 'string' },
  ],
} as const;

export const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
} as const;

const CLOB_AUTH_MESSAGE = 'This message attests that I control the given wallet';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface L2Credentials {
  apiKey: string;
  secret: string;
  passphrase: string;
}

export interface TargetMarket {
  conditionId: string;
  tokenId: string;
  question: string;
  negRisk: boolean;
  tickSize: number;
  minOrderSize: number;
  bestBid: number | null;
  bestAsk: number | null;
}

export interface TestContext {
  address: string;
  walletClient: ReturnType<typeof createWalletClient>;
  creds: L2Credentials;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export function log(step: string, msg: string) {
  console.log(`  [${step}] ${msg}`);
}

export function pass(msg: string) {
  console.log(`\x1b[32m  ✓ ${msg}\x1b[0m`);
}

export function fail(msg: string): never {
  console.error(`\x1b[31m  ✗ ${msg}\x1b[0m`);
  process.exit(1);
}

export function warn(msg: string) {
  console.log(`\x1b[33m  ⚠ ${msg}\x1b[0m`);
}

// ---------------------------------------------------------------------------
// Wallet & Auth
// ---------------------------------------------------------------------------

export function loadPrivateKey(): Hex {
  const locations = [
    path.resolve(__dirname, '../../.env.test.local'),
    path.resolve(__dirname, '../../../../.env.test.local'),
  ];

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      const content = fs.readFileSync(loc, 'utf-8');
      const match = content.match(/^TEST_PRIVATE_KEY=(.+)$/m);
      if (match) {
        const key = match[1].trim();
        if (!key.startsWith('0x')) return `0x${key}` as Hex;
        return key as Hex;
      }
    }
  }

  fail('TEST_PRIVATE_KEY not found. Create apps/web/.env.test.local with TEST_PRIVATE_KEY=0x...');
}

export function createTestWallet() {
  const privateKey = loadPrivateKey();
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });
  return { address: account.address, walletClient };
}

export function hmacSign(
  secret: string,
  timestamp: string,
  method: string,
  requestPath: string,
  body?: string,
): string {
  let normalized = secret.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  if (pad === 2) normalized += '==';
  else if (pad === 3) normalized += '=';

  const secretBytes = Buffer.from(normalized, 'base64');
  let message = timestamp + method + requestPath;
  if (body) message += body;

  const sig = crypto.createHmac('sha256', secretBytes).update(message).digest('base64');
  return sig.replace(/\+/g, '-').replace(/\//g, '_');
}

export function buildL2Headers(
  creds: L2Credentials,
  address: string,
  method: string,
  requestPath: string,
  body?: string,
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = hmacSign(creds.secret, timestamp, method, requestPath, body);
  return {
    POLY_ADDRESS: address,
    POLY_SIGNATURE: signature,
    POLY_TIMESTAMP: timestamp,
    POLY_API_KEY: creds.apiKey,
    POLY_PASSPHRASE: creds.passphrase,
  };
}

export async function deriveCredentials(
  walletClient: ReturnType<typeof createWalletClient>,
  address: string,
): Promise<L2Credentials> {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const l1Signature = await walletClient.signTypedData({
    domain: CLOB_AUTH_DOMAIN,
    types: CLOB_AUTH_TYPES,
    primaryType: 'ClobAuth',
    message: {
      address: address as Hex,
      timestamp,
      nonce: 0n,
      message: CLOB_AUTH_MESSAGE,
    },
  });

  const l1Headers = {
    POLY_ADDRESS: address,
    POLY_SIGNATURE: l1Signature,
    POLY_TIMESTAMP: timestamp,
    POLY_NONCE: '0',
  };

  // Try derive first, then create
  const deriveRes = await fetch(`${CLOB_BASE}/auth/derive-api-key`, { headers: l1Headers });
  if (deriveRes.ok) return deriveRes.json();

  const createRes = await fetch(`${CLOB_BASE}/auth/api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...l1Headers },
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    fail(`Failed to create API key: ${createRes.status} ${err}`);
  }
  return createRes.json();
}

// ---------------------------------------------------------------------------
// On-chain Approvals
// ---------------------------------------------------------------------------

const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as Hex;
const CTF_ADDRESS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as Hex;
const CTF_EXCHANGE_ADDRESS = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as Hex;
const NEG_RISK_CTF_EXCHANGE_ADDRESS = '0xC5d563A36AE78145C45a50134d48A1215220f80a' as Hex;
const NEG_RISK_ADAPTER_ADDRESS = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296' as Hex;
const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

const ERC20_ABI = [
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const;

const ERC1155_ABI = [
  { name: 'isApprovedForAll', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: 'operator', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'setApprovalForAll', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [] },
] as const;

async function ensureApprovals(
  walletClient: ReturnType<typeof createWalletClient>,
  address: string,
) {
  const publicClient = createPublicClient({ chain: polygon, transport: http('https://polygon-rpc.com') });

  // 1. USDC approval for CTF Exchange
  const usdcAllowance = await publicClient.readContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'allowance',
    args: [address as Hex, CTF_EXCHANGE_ADDRESS],
  });
  if (usdcAllowance < MAX_UINT256 / 2n) {
    log('setup', 'Approving USDC for CTF Exchange...');
    const hash = await walletClient.sendTransaction({
      to: USDC_ADDRESS, chain: polygon,
      data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [CTF_EXCHANGE_ADDRESS, MAX_UINT256] }),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    pass('USDC approved for CTF Exchange');
  } else {
    pass('USDC already approved for CTF Exchange');
  }

  // 2. USDC approval for NegRisk CTF Exchange
  const usdcAllowanceNeg = await publicClient.readContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'allowance',
    args: [address as Hex, NEG_RISK_CTF_EXCHANGE_ADDRESS],
  });
  if (usdcAllowanceNeg < MAX_UINT256 / 2n) {
    log('setup', 'Approving USDC for NegRisk CTF Exchange...');
    const hash = await walletClient.sendTransaction({
      to: USDC_ADDRESS, chain: polygon,
      data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [NEG_RISK_CTF_EXCHANGE_ADDRESS, MAX_UINT256] }),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    pass('USDC approved for NegRisk CTF Exchange');
  } else {
    pass('USDC already approved for NegRisk CTF Exchange');
  }

  // 3. CTF (ERC-1155) approval for CTF Exchange (needed for SELL)
  const ctfApproved = await publicClient.readContract({
    address: CTF_ADDRESS, abi: ERC1155_ABI, functionName: 'isApprovedForAll',
    args: [address as Hex, CTF_EXCHANGE_ADDRESS],
  });
  if (!ctfApproved) {
    log('setup', 'Approving CTF tokens for CTF Exchange...');
    const hash = await walletClient.sendTransaction({
      to: CTF_ADDRESS, chain: polygon,
      data: encodeFunctionData({ abi: ERC1155_ABI, functionName: 'setApprovalForAll', args: [CTF_EXCHANGE_ADDRESS, true] }),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    pass('CTF approved for CTF Exchange');
  } else {
    pass('CTF already approved for CTF Exchange');
  }

  // 4. CTF (ERC-1155) approval for NegRisk CTF Exchange (needed for SELL on neg_risk)
  const ctfApprovedNeg = await publicClient.readContract({
    address: CTF_ADDRESS, abi: ERC1155_ABI, functionName: 'isApprovedForAll',
    args: [address as Hex, NEG_RISK_CTF_EXCHANGE_ADDRESS],
  });
  if (!ctfApprovedNeg) {
    log('setup', 'Approving CTF tokens for NegRisk CTF Exchange...');
    const hash = await walletClient.sendTransaction({
      to: CTF_ADDRESS, chain: polygon,
      data: encodeFunctionData({ abi: ERC1155_ABI, functionName: 'setApprovalForAll', args: [NEG_RISK_CTF_EXCHANGE_ADDRESS, true] }),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    pass('CTF approved for NegRisk CTF Exchange');
  } else {
    pass('CTF already approved for NegRisk CTF Exchange');
  }

  // 5. CTF (ERC-1155) approval for NegRisk Adapter (needed for neg_risk SELL)
  const ctfApprovedAdapter = await publicClient.readContract({
    address: CTF_ADDRESS, abi: ERC1155_ABI, functionName: 'isApprovedForAll',
    args: [address as Hex, NEG_RISK_ADAPTER_ADDRESS],
  });
  if (!ctfApprovedAdapter) {
    log('setup', 'Approving CTF tokens for NegRisk Adapter...');
    const hash = await walletClient.sendTransaction({
      to: CTF_ADDRESS, chain: polygon,
      data: encodeFunctionData({ abi: ERC1155_ABI, functionName: 'setApprovalForAll', args: [NEG_RISK_ADAPTER_ADDRESS, true] }),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    pass('CTF approved for NegRisk Adapter');
  } else {
    pass('CTF already approved for NegRisk Adapter');
  }
}

export async function setupTestContext(): Promise<TestContext> {
  const { address, walletClient } = createTestWallet();
  log('setup', `Wallet: ${address}`);

  const creds = await deriveCredentials(walletClient, address);
  pass('CLOB credentials ready');

  await ensureApprovals(walletClient, address);

  return { address, walletClient: walletClient as any, creds };
}

// ---------------------------------------------------------------------------
// Market Discovery
// ---------------------------------------------------------------------------

export async function findMarket(opts: {
  negRisk?: boolean;
  minTickSize?: number;
  maxTickSize?: number;
}): Promise<TargetMarket> {
  const eventsRes = await fetch(`${GAMMA_BASE}/events?limit=20&active=true&closed=false`);
  if (!eventsRes.ok) fail(`Gamma API failed: ${eventsRes.status}`);
  const events = await eventsRes.json();

  for (const event of events) {
    for (const market of event.markets ?? []) {
      const cid = market.conditionId;
      if (!cid) continue;

      const clobRes = await fetch(`${CLOB_BASE}/markets/${cid}`);
      if (!clobRes.ok) continue;

      const cm = await clobRes.json();
      if (!cm.accepting_orders || cm.closed) continue;

      const firstToken = cm.tokens?.[0];
      if (!firstToken?.token_id) continue;

      const negRisk = cm.neg_risk ?? false;
      const tickSize = cm.minimum_tick_size ?? 0.01;

      // Apply filters
      if (opts.negRisk !== undefined && negRisk !== opts.negRisk) continue;
      if (opts.minTickSize !== undefined && tickSize < opts.minTickSize) continue;
      if (opts.maxTickSize !== undefined && tickSize > opts.maxTickSize) continue;

      // Fetch orderbook to get best bid/ask
      let bestBid: number | null = null;
      let bestAsk: number | null = null;
      try {
        const bookRes = await fetch(`${CLOB_BASE}/book?token_id=${firstToken.token_id}`);
        if (bookRes.ok) {
          const book = await bookRes.json();
          const bids = (book.bids ?? []).map((l: { price: string }) => parseFloat(l.price)).sort((a: number, b: number) => b - a);
          const asks = (book.asks ?? []).map((l: { price: string }) => parseFloat(l.price)).sort((a: number, b: number) => a - b);
          bestBid = bids[0] ?? null;
          bestAsk = asks[0] ?? null;
        }
      } catch { /* orderbook fetch is best-effort */ }

      return {
        conditionId: cid,
        tokenId: firstToken.token_id,
        question: cm.question || market.question || '?',
        negRisk,
        tickSize,
        minOrderSize: cm.minimum_order_size ?? 5,
        bestBid,
        bestAsk,
      };
    }
  }

  fail(`No market found matching filters: ${JSON.stringify(opts)}`);
}

// ---------------------------------------------------------------------------
// Order Helpers
// ---------------------------------------------------------------------------

export function generateSalt(): string {
  const bytes = crypto.randomBytes(8);
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  const mask = (1n << 53n) - 1n;
  return (value & mask).toString();
}

export function calculateAmounts(
  priceCents: number,
  size: number,
  side: 'BUY' | 'SELL',
): { makerAmount: string; takerAmount: string } {
  const sharesInt = BigInt(Math.round(size * 100));
  const priceTenths = BigInt(Math.round(priceCents * 10));
  const sharesBaseUnits = (sharesInt * 10_000n).toString();
  const usdcBaseUnits = (priceTenths * sharesInt * 10n).toString();

  return side === 'BUY'
    ? { makerAmount: usdcBaseUnits, takerAmount: sharesBaseUnits }
    : { makerAmount: sharesBaseUnits, takerAmount: usdcBaseUnits };
}

export async function signAndBuildOrder(
  ctx: TestContext,
  market: TargetMarket,
  priceCents: number,
  size: number,
  side: 'BUY' | 'SELL',
) {
  const { makerAmount, takerAmount } = calculateAmounts(priceCents, size, side);
  const salt = generateSalt();

  const orderStruct = {
    salt,
    maker: ctx.address,
    signer: ctx.address,
    taker: '0x0000000000000000000000000000000000000000' as Hex,
    tokenId: market.tokenId,
    makerAmount,
    takerAmount,
    expiration: '0',
    nonce: '0',
    feeRateBps: '0',
    side: side === 'BUY' ? 0 : 1,
    signatureType: 0,
  };

  const domain = market.negRisk ? NEG_RISK_CTF_EXCHANGE_DOMAIN : CTF_EXCHANGE_DOMAIN;

  const signature = await ctx.walletClient.signTypedData({
    domain,
    types: ORDER_TYPES,
    primaryType: 'Order',
    message: {
      salt: BigInt(orderStruct.salt),
      maker: orderStruct.maker as Hex,
      signer: orderStruct.signer as Hex,
      taker: orderStruct.taker,
      tokenId: BigInt(orderStruct.tokenId),
      makerAmount: BigInt(orderStruct.makerAmount),
      takerAmount: BigInt(orderStruct.takerAmount),
      expiration: BigInt(orderStruct.expiration),
      nonce: BigInt(orderStruct.nonce),
      feeRateBps: BigInt(orderStruct.feeRateBps),
      side: orderStruct.side,
      signatureType: orderStruct.signatureType,
    },
  });

  return {
    deferExec: false,
    order: {
      salt: Number(BigInt(orderStruct.salt)),
      maker: orderStruct.maker,
      signer: orderStruct.signer,
      taker: orderStruct.taker,
      tokenId: orderStruct.tokenId,
      makerAmount: orderStruct.makerAmount,
      takerAmount: orderStruct.takerAmount,
      expiration: orderStruct.expiration,
      nonce: orderStruct.nonce,
      feeRateBps: orderStruct.feeRateBps,
      side: side,
      signatureType: orderStruct.signatureType,
      signature,
    },
    owner: ctx.creds.apiKey,
    orderType: 'GTC',
  };
}

export async function submitOrder(
  ctx: TestContext,
  orderBody: ReturnType<typeof signAndBuildOrder> extends Promise<infer T> ? T : never,
): Promise<string> {
  const bodyStr = JSON.stringify(orderBody);
  const l2Headers = buildL2Headers(ctx.creds, ctx.address, 'POST', '/order', bodyStr);

  const res = await fetch(`${CLOB_BASE}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...l2Headers },
    body: bodyStr,
  });

  const result = await res.json().catch(() => ({}));

  if (!res.ok || !result.success) {
    const msg = result.error || result.errorMsg || result.message || `HTTP ${res.status}`;
    throw new Error(`Order submission failed: ${msg}`);
  }

  const orderId = result.orderID || result.orderId;
  if (!orderId) throw new Error('Order accepted but no orderId returned');
  return orderId;
}

export async function cancelOrder(ctx: TestContext, orderId: string): Promise<void> {
  const cancelBody = JSON.stringify({ orderID: orderId });
  const l2Headers = buildL2Headers(ctx.creds, ctx.address, 'DELETE', '/order', cancelBody);

  const res = await fetch(`${CLOB_BASE}/order`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...l2Headers },
    body: cancelBody,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cancel failed: ${res.status} ${err}`);
  }

  const result = await res.json().catch(() => ({}));
  const notCanceled = result.not_canceled ?? {};
  if (Object.keys(notCanceled).length > 0) {
    throw new Error(`Not cancelled: ${JSON.stringify(notCanceled)}`);
  }
}

export async function getOpenOrders(ctx: TestContext): Promise<Array<{ id: string; status: string; [key: string]: unknown }>> {
  const l2Headers = buildL2Headers(ctx.creds, ctx.address, 'GET', '/data/orders');
  const res = await fetch(`${CLOB_BASE}/data/orders`, { headers: l2Headers });
  if (!res.ok) throw new Error(`Failed to fetch open orders: ${res.status}`);
  const body = await res.json();
  return Array.isArray(body) ? body : (body?.data ?? []);
}

export async function getPositions(ctx: TestContext): Promise<Array<{ asset: string; size: number; [key: string]: unknown }>> {
  const l2Headers = buildL2Headers(ctx.creds, ctx.address, 'GET', '/data/positions');
  // Data API uses different base URL
  const res = await fetch(`https://data-api.polymarket.com/positions?user=${ctx.address}&sizeThreshold=0`);
  if (!res.ok) throw new Error(`Failed to fetch positions: ${res.status}`);
  return res.json();
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Cleanup — sell all open positions
// ---------------------------------------------------------------------------

export async function cleanupPositions(ctx: TestContext): Promise<{ sold: number; failed: number; kept: number }> {
  let sold = 0;
  let failed = 0;
  let kept = 0;
  const keeperIds = getKeeperTokenIds();

  // 1. Cancel all open orders first so they don't block sells
  try {
    const orders = await getOpenOrders(ctx);
    for (const order of orders) {
      try {
        await cancelOrder(ctx, order.id);
      } catch { /* best effort */ }
    }
    if (orders.length > 0) {
      log('cleanup', `Cancelled ${orders.length} open order(s)`);
      await sleep(1000);
    }
  } catch { /* no open orders */ }

  // 2. Fetch all positions from Data API
  let positions: Array<{ asset: string; size: number; conditionId?: string; [key: string]: unknown }>;
  try {
    const res = await fetch(`https://data-api.polymarket.com/positions?user=${ctx.address}&sizeThreshold=0`);
    if (!res.ok) {
      warn(`Could not fetch positions for cleanup: ${res.status}`);
      return { sold: 0, failed: 0 };
    }
    positions = await res.json();
  } catch {
    warn('Could not fetch positions for cleanup');
    return { sold: 0, failed: 0, kept: 0 };
  }

  // Filter to positions with size > 0, skip keepers
  const allOpen = positions.filter((p) => p.size > 0);
  const openPositions = allOpen.filter((p) => !keeperIds.has(p.asset));
  kept = allOpen.length - openPositions.length;

  if (kept > 0) {
    log('cleanup', `Keeping ${kept} position(s) for redemption testing`);
  }
  if (openPositions.length === 0) {
    log('cleanup', 'No positions to clean up');
    return { sold: 0, failed: 0, kept };
  }

  log('cleanup', `Found ${openPositions.length} position(s) to close`);

  for (const pos of openPositions) {
    const tokenId = pos.asset;
    const size = Math.floor(pos.size * 100) / 100; // truncate to 2 decimals
    if (size <= 0) continue;

    try {
      // Look up CLOB market for this token to get negRisk + tick size
      const conditionId = (pos as Record<string, unknown>).conditionId as string | undefined;
      let negRisk = false;
      let tickSize = 0.01;

      if (conditionId) {
        try {
          const clobRes = await fetch(`${CLOB_BASE}/markets/${conditionId}`);
          if (clobRes.ok) {
            const cm = await clobRes.json();
            negRisk = cm.neg_risk ?? false;
            tickSize = cm.minimum_tick_size ?? 0.01;
          }
        } catch { /* defaults */ }
      }

      const tickCents = tickSize * 100; // e.g. 0.001 → 0.1c
      const minPriceCents = tickCents; // minimum valid price for this tick size

      // Get best bid to price the sell
      let sellPriceCents = minPriceCents;
      try {
        const bookRes = await fetch(`${CLOB_BASE}/book?token_id=${tokenId}`);
        if (bookRes.ok) {
          const book = await bookRes.json();
          const bids = (book.bids ?? [])
            .map((l: { price: string }) => parseFloat(l.price))
            .sort((a: number, b: number) => b - a);
          if (bids[0] > 0) {
            const bestBidCents = bids[0] * 100;
            sellPriceCents = Math.max(bestBidCents - 3 * tickCents, minPriceCents);
            // Snap to tick grid
            sellPriceCents = Math.round(sellPriceCents / tickCents) * tickCents;
          }
        }
      } catch { /* use floor price */ }

      const market: TargetMarket = {
        conditionId: conditionId ?? '',
        tokenId,
        question: '(cleanup)',
        negRisk,
        tickSize,
        minOrderSize: 5,
        bestBid: sellPriceCents / 100,
        bestAsk: null,
      };

      log('cleanup', `Selling ${size} shares of ${tokenId.substring(0, 16)}... at ${sellPriceCents}c`);
      const orderBody = await signAndBuildOrder(ctx, market, sellPriceCents, size, 'SELL');
      await submitOrder(ctx, orderBody);
      pass(`Closed position: ${size} shares`);
      sold++;
      await sleep(500);
    } catch (err: any) {
      warn(`Failed to close position ${tokenId.substring(0, 16)}...: ${err.message}`);
      failed++;
    }
  }

  return { sold, failed, kept };
}
