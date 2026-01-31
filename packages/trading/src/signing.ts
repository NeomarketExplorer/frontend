/**
 * EIP-712 order signing for Polymarket CTF Exchange
 * Signs orders using the wallet's signTypedData capability
 */

import { CTF_EXCHANGE_DOMAIN } from '@app/config';
import { type SignedOrder } from './orders';

// Type definition for the signTypedData function (wallet-agnostic)
export type SignTypedDataFn = (params: {
  account: string;
  domain: typeof CTF_EXCHANGE_DOMAIN;
  types: typeof ORDER_TYPES;
  primaryType: 'Order';
  message: Record<string, unknown>;
}) => Promise<string>;

// EIP-712 Order type definition for CTF Exchange
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

/**
 * Sign an order using EIP-712 typed data via the wallet provider.
 * Uses CTF_EXCHANGE_DOMAIN (NOT ClobAuthDomain — different domain!).
 *
 * @param order - Order struct without signature
 * @param signerAddress - Address of the signer
 * @param signTypedDataFn - Wallet-provided signTypedData function
 * @returns SignedOrder with signature attached
 */
export async function signOrder(
  order: Omit<SignedOrder, 'signature'>,
  signerAddress: string,
  signTypedDataFn: SignTypedDataFn
): Promise<SignedOrder> {
  const message: Record<string, unknown> = {
    salt: order.salt,
    maker: order.maker,
    signer: order.signer,
    taker: order.taker,
    tokenId: order.tokenId,
    makerAmount: order.makerAmount,
    takerAmount: order.takerAmount,
    expiration: order.expiration,
    nonce: order.nonce,
    feeRateBps: order.feeRateBps,
    side: order.side,
    signatureType: order.signatureType,
  };

  const signature = await signTypedDataFn({
    account: signerAddress,
    domain: CTF_EXCHANGE_DOMAIN,
    types: ORDER_TYPES,
    primaryType: 'Order',
    message,
  });

  return {
    ...order,
    signature,
  };
}

/**
 * Build the POST /order request body from a signed order
 */
export function buildOrderRequestBody(
  signedOrder: SignedOrder,
  ownerApiKey: string,
  orderType: string = 'GTC'
) {
  const salt =
    typeof signedOrder.salt === 'string' && signedOrder.salt.startsWith('0x')
      ? BigInt(signedOrder.salt).toString(10)
      : signedOrder.salt;
  return {
    order: {
      ...signedOrder,
      salt,
    },
    owner: ownerApiKey,
    orderType,
  };
}
