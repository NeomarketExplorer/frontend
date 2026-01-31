/**
 * HMAC-SHA256 signing for Polymarket CLOB API
 * Used for both builder attribution and per-user L2 authentication
 */

/** Convert base64url to standard base64 (Polymarket secrets may use either) */
export function normalizeBase64(secret: string): string {
  // Replace URL-safe chars with standard base64 chars
  let normalized = secret.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const pad = normalized.length % 4;
  if (pad === 2) normalized += '==';
  else if (pad === 3) normalized += '=';
  return normalized;
}

/** Build the HMAC message string: timestamp + method + path + body */
export function buildHmacMessage(
  timestamp: string,
  method: string,
  path: string,
  body?: string
): string {
  let message = timestamp + method + path;
  if (body) message += body;
  return message;
}

/**
 * Sign a message with HMAC-SHA256 using Web Crypto API
 * Returns URL-safe base64 encoded signature
 */
export async function hmacSign(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body?: string
): Promise<string> {
  const message = buildHmacMessage(timestamp, method, path, body);

  // Decode base64 secret to raw bytes
  const normalizedSecret = normalizeBase64(secret);
  const secretBytes = Uint8Array.from(atob(normalizedSecret), c => c.charCodeAt(0));

  // Import key for HMAC-SHA256
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the message
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  // Convert to URL-safe base64 (keep '=' padding per Polymarket spec)
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_');
}

/** Build L2 auth headers for per-user CLOB requests */
export function buildL2Headers(
  apiKey: string,
  signature: string,
  timestamp: string,
  passphrase: string,
  address: string
): Record<string, string> {
  return {
    POLY_ADDRESS: address,
    POLY_SIGNATURE: signature,
    POLY_TIMESTAMP: timestamp,
    POLY_API_KEY: apiKey,
    POLY_PASSPHRASE: passphrase,
  };
}

/** Build builder attribution headers for order submission */
export function buildBuilderHeaders(
  apiKey: string,
  signature: string,
  timestamp: string,
  passphrase: string
): Record<string, string> {
  return {
    POLY_BUILDER_SIGNATURE: signature,
    POLY_BUILDER_TIMESTAMP: timestamp,
    POLY_BUILDER_API_KEY: apiKey,
    POLY_BUILDER_PASSPHRASE: passphrase,
  };
}
