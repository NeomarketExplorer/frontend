/**
 * Order placement and management
 */

import { z } from 'zod';

// Order types
export const OrderSideSchema = z.enum(['BUY', 'SELL']);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const OrderTypeSchema = z.enum(['GTC', 'FOK', 'GTD']);
export type OrderType = z.infer<typeof OrderTypeSchema>;

export interface OrderParams {
  tokenId: string;
  side: OrderSide;
  price: number; // In cents (1-99), may be fractional for sub-cent tick sizes
  size: number; // Number of shares
  orderType?: OrderType;
  expiration?: number; // Unix timestamp for GTD orders
  negRisk?: boolean; // True for multi-outcome markets (uses different exchange contract)
}

/** Per-market constraints from CLOB /markets/{conditionId}. All optional — falls back to defaults. */
export interface MarketConstraints {
  /** Minimum tick size as a decimal (e.g. 0.01 = 1c, 0.001 = 0.1c). Default 0.01. */
  tickSize?: number;
  /** Minimum order size in shares. Default 5. */
  minOrderSize?: number;
}

// Polymarket CLOB enforces a minimum order size (in shares) for submission.
// When violated, the API returns errors like:
// "Size (3) lower than the minimum: 5"
export const MIN_ORDER_SHARES = 5;
export const SHARE_STEP = 0.01; // CLOB supports max 2 decimals for conditional token amount
export const USDC_STEP = 0.0001; // CLOB supports max 4 decimals for USDC amount

/** Default tick size (1 cent = 0.01) */
export const DEFAULT_TICK_SIZE = 0.01;

/**
 * Convert a tick size (decimal, e.g. 0.001) to cents.
 * 0.01 → 1c, 0.001 → 0.1c
 */
export function tickSizeToCents(tickSize: number): number {
  return tickSize * 100;
}

/**
 * Snap a price (in cents) to the nearest valid tick.
 * E.g. tickSize=0.001 (0.1c) → snaps to nearest 0.1c
 */
export function snapToTick(priceCents: number, tickSize: number): number {
  const tickCents = tickSizeToCents(tickSize);
  return Math.round(priceCents / tickCents) * tickCents;
}

/**
 * Get the number of decimal places for the price input (in cents) based on tick size.
 * tickSize=0.01 → 0 decimals (whole cents), tickSize=0.001 → 1 decimal (0.1c)
 */
export function tickSizePriceDecimals(tickSize: number): number {
  const tickCents = tickSizeToCents(tickSize);
  if (tickCents >= 1) return 0;
  // Count decimals: 0.1 → 1, 0.01 → 2, etc.
  return Math.max(0, Math.ceil(-Math.log10(tickCents + 1e-15)));
}

export interface SignedOrder {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: number;
  signatureType: number;
  signature: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

/**
 * Calculate order amounts based on price and size.
 *
 * Uses integer arithmetic to avoid floating-point precision errors.
 * Price is in cents (1-99, possibly fractional for sub-cent tick sizes).
 * USDC has 6 decimals (1 USDC = 1_000_000 base units).
 * Conditional tokens have 6 decimals (1 share = 1_000_000 base units).
 *
 * For BUY: pay USDC base units, receive shares base units
 * For SELL: pay shares base units, receive USDC base units
 */
export function calculateOrderAmounts(
  price: number,
  size: number,
  side: OrderSide
): { makerAmount: string; takerAmount: string } {
  // CLOB validates amount precision:
  // - Conditional token amount (shares): max 2 decimals => base units multiple of 10_000
  // - USDC amount: max 4 decimals => base units multiple of 100
  //
  // We operate in integer math (BigInt) to avoid float drift and to guarantee multiples.
  const sharesInt = BigInt(Math.round(size * 100)); // shares * 100 (2 decimals)

  // Token base units: 1 share = 1_000_000 units, but we only allow 0.01 share steps => 10_000 units.
  const sharesBaseUnits = sharesInt * 10_000n;

  // Price may be fractional cents (e.g. 50.5c for 0.001 tick markets).
  // Convert to integer at 0.1c precision (price * 10) to stay in BigInt math.
  // USDC base units = (priceCents / 100) * size * 1_000_000
  //                  = (priceTenths / 1000) * (sharesInt / 100) * 1_000_000
  //                  = priceTenths * sharesInt * 10
  const priceTenths = BigInt(Math.round(price * 10)); // cents * 10
  const usdcBaseUnits = priceTenths * sharesInt * 10n;

  if (side === 'BUY') {
    return {
      makerAmount: usdcBaseUnits.toString(),
      takerAmount: sharesBaseUnits.toString(),
    };
  } else {
    return {
      makerAmount: sharesBaseUnits.toString(),
      takerAmount: usdcBaseUnits.toString(),
    };
  }
}

/**
 * Build order struct for signing
 */
export function buildOrderStruct(
  params: OrderParams,
  maker: string,
  nonce: string,
  feeRateBps = '0'
): Omit<SignedOrder, 'signature'> {
  const { makerAmount, takerAmount } = calculateOrderAmounts(
    params.price,
    params.size,
    params.side
  );

  const salt = generateSalt();
  const expiration = params.expiration?.toString() ?? '0';

  return {
    salt,
    maker,
    signer: maker,
    taker: '0x0000000000000000000000000000000000000000',
    tokenId: params.tokenId,
    makerAmount,
    takerAmount,
    expiration,
    nonce,
    feeRateBps,
    side: params.side === 'BUY' ? 0 : 1,
    signatureType: 0, // EOA signature
  };
}

/**
 * Generate a random salt for orders (decimal string, safe integer).
 * Polymarket API expects parseInt(salt, 10) to work correctly.
 */
function generateSalt(): string {
  const randomBytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 8; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // Convert to a BigInt then clamp to 53-bit safe integer
  let value = 0n;
  for (const byte of randomBytes) {
    value = (value << 8n) | BigInt(byte);
  }
  const mask = (1n << 53n) - 1n;
  return (value & mask).toString();
}

/**
 * Create EIP-712 typed data for order signing
 */
export function createOrderTypedData(
  order: Omit<SignedOrder, 'signature'>,
  chainId: number,
  exchangeAddress: string
) {
  const domain = {
    name: 'Polymarket CTF Exchange',
    version: '1',
    chainId,
    verifyingContract: exchangeAddress as `0x${string}`,
  };

  const types = {
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
  };

  const message = {
    salt: BigInt(order.salt),
    maker: order.maker as `0x${string}`,
    signer: order.signer as `0x${string}`,
    taker: order.taker as `0x${string}`,
    tokenId: BigInt(order.tokenId),
    makerAmount: BigInt(order.makerAmount),
    takerAmount: BigInt(order.takerAmount),
    expiration: BigInt(order.expiration),
    nonce: BigInt(order.nonce),
    feeRateBps: BigInt(order.feeRateBps),
    side: order.side,
    signatureType: order.signatureType,
  };

  return { domain, types, message };
}

/**
 * Validate order parameters before submission.
 * Accepts optional per-market constraints from CLOB metadata.
 */
export function validateOrderParams(
  params: OrderParams,
  constraints?: MarketConstraints,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const tickSize = constraints?.tickSize ?? DEFAULT_TICK_SIZE;
  const minOrderSize = constraints?.minOrderSize ?? MIN_ORDER_SHARES;
  const tickCents = tickSizeToCents(tickSize);
  const priceDecimals = tickSizePriceDecimals(tickSize);

  if (!params.tokenId) {
    errors.push('Token ID is required');
  }

  if (params.price < tickCents || params.price > 99) {
    errors.push(`Price must be between ${tickCents} and 99 cents`);
  } else {
    // Validate price aligns to tick size
    const snapped = snapToTick(params.price, tickSize);
    if (Math.abs(params.price - snapped) > 1e-9) {
      errors.push(
        priceDecimals === 0
          ? 'Price must be a whole number of cents'
          : `Price must be in ${tickCents} cent increments`
      );
    }
  }

  if (params.size <= 0) {
    errors.push('Size must be positive');
  }

  if (params.size < minOrderSize) {
    errors.push(`Minimum order size is ${minOrderSize} shares`);
  }

  // CLOB: conditional token amount supports max 2 decimals.
  const scaled = params.size * 100;
  if (Number.isFinite(scaled)) {
    const rounded = Math.round(scaled);
    if (Math.abs(scaled - rounded) > 1e-8) {
      errors.push('Size must be in 0.01 share increments');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate estimated cost/proceeds of an order
 */
export function calculateOrderEstimate(params: OrderParams): {
  cost: number;
  potentialReturn: number;
  potentialPnL: number;
} {
  const priceDecimal = params.price / 100;
  const cost = priceDecimal * params.size;

  if (params.side === 'BUY') {
    // If we buy and win, we get $1 per share
    const maxReturn = params.size;
    const potentialReturn = maxReturn - cost;
    return {
      cost,
      potentialReturn: maxReturn,
      potentialPnL: potentialReturn,
    };
  } else {
    // If we sell, we get the cost immediately
    return {
      cost: 0, // No cost for selling (we're selling shares we have)
      potentialReturn: cost,
      potentialPnL: cost,
    };
  }
}
