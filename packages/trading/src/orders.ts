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
 * Calculate order amounts based on price and size
 */
export function calculateOrderAmounts(
  price: number,
  size: number,
  side: OrderSide
): { makerAmount: number; takerAmount: number } {
  // Price is in cents (0.01 - 0.99)
  // For BUY: pay (price * size) USDC, receive (size) shares
  // For SELL: pay (size) shares, receive (price * size) USDC

  const priceDecimal = price / 100; // Convert cents to decimal
  const cost = priceDecimal * size;

  if (side === 'BUY') {
    return {
      makerAmount: Math.floor(cost * 1e6), // USDC has 6 decimals
      takerAmount: Math.floor(size * 1e6), // Shares have 6 decimals
    };
  } else {
    return {
      makerAmount: Math.floor(size * 1e6),
      takerAmount: Math.floor(cost * 1e6),
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
 * Generate a random salt for orders
 */
function generateSalt(): string {
  const randomBytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // Fallback for non-browser environments
    for (let i = 0; i < 32; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
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
