/**
 * Polymarket CLOB authentication
 * L1 auth: EIP-712 ClobAuth signing for credential derivation
 * L2 auth: HMAC-SHA256 signing for authenticated CLOB requests
 */

import { CLOB_AUTH_DOMAIN } from '@app/config';
import { hmacSign, buildL2Headers } from './hmac';

// EIP-712 type definition for ClobAuth
export const CLOB_AUTH_TYPES = {
  ClobAuth: [
    { name: 'address', type: 'address' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'message', type: 'string' },
  ],
} as const;

// The attestation message required by Polymarket
export const CLOB_AUTH_MESSAGE_TEXT =
  'This message attests that I control the given wallet';

/** L2 credentials returned by /auth/api-key and /auth/derive-api-key */
export interface L2Credentials {
  apiKey: string;
  secret: string;
  passphrase: string;
}

/**
 * Build EIP-712 typed data for ClobAuth (L1 authentication)
 * Used to derive or create CLOB API credentials
 */
export function buildClobAuthTypedData(address: string, timestamp: string) {
  return {
    domain: CLOB_AUTH_DOMAIN,
    types: CLOB_AUTH_TYPES,
    primaryType: 'ClobAuth' as const,
    message: {
      address: address as `0x${string}`,
      timestamp,
      nonce: 0n,
      message: CLOB_AUTH_MESSAGE_TEXT,
    },
  };
}

/**
 * Build L1 auth headers from a signed ClobAuth message
 * Used for /auth/api-key and /auth/derive-api-key endpoints
 */
export function buildL1Headers(
  address: string,
  signature: string,
  timestamp: string,
  nonce: string = '0'
): Record<string, string> {
  return {
    POLY_ADDRESS: address,
    POLY_SIGNATURE: signature,
    POLY_TIMESTAMP: timestamp,
    POLY_NONCE: nonce,
  };
}

/**
 * Sign a CLOB API request with L2 credentials (per-user HMAC)
 * Returns all headers needed for an authenticated CLOB request
 */
export async function signClobRequest(
  credentials: L2Credentials,
  address: string,
  method: string,
  path: string,
  body?: string
): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await hmacSign(
    credentials.secret,
    timestamp,
    method,
    path,
    body
  );
  return buildL2Headers(
    credentials.apiKey,
    signature,
    timestamp,
    credentials.passphrase,
    address
  );
}
