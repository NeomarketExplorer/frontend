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
  price: number; // In cents (1-99)
  size: number; // Number of shares
  orderType?: OrderType;
  expiration?: number; // Unix timestamp for GTD orders
  negRisk?: boolean; // True for multi-outcome markets (uses different exchange contract)
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
 * Price is in cents (1-99), USDC has 6 decimals.
 * 1 cent = 0.01 USDC = 10_000 base units (0.01 * 1e6).
 *
 * For BUY: pay (price * size * 10000) USDC base units, receive (size * 1e6) shares
 * For SELL: pay (size * 1e6) shares, receive (price * size * 10000) USDC base units
 */
export function calculateOrderAmounts(
  price: number,
  size: number,
  side: OrderSide
): { makerAmount: number; takerAmount: number } {
  // Round to avoid any residual floating-point error from fractional sizes
  const costBaseUnits = Math.round(price * size * 10_000);
  const sizeBaseUnits = Math.round(size * 1_000_000);

  if (side === 'BUY') {
    return {
      makerAmount: costBaseUnits,
      takerAmount: sizeBaseUnits,
    };
  } else {
    return {
      makerAmount: sizeBaseUnits,
      takerAmount: costBaseUnits,
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
    makerAmount: makerAmount.toString(),
    takerAmount: takerAmount.toString(),
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
 * Validate order parameters before submission
 */
export function validateOrderParams(params: OrderParams): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!params.tokenId) {
    errors.push('Token ID is required');
  }

  if (params.price < 1 || params.price > 99) {
    errors.push('Price must be between 1 and 99 cents');
  } else if (!Number.isInteger(params.price)) {
    errors.push('Price must be a whole number of cents');
  }

  if (params.size <= 0) {
    errors.push('Size must be positive');
  }

  if (params.size < 1) {
    errors.push('Minimum order size is 1 share');
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
