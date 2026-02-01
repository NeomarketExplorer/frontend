import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Exact-match origin allowlist — no startsWith, no substrings
const ALLOWED_ORIGINS = new Set([
  'https://neomarket.bet',
  'https://www.neomarket.bet',
  'http://localhost:3000',
]);

// Only sign requests to known CLOB paths
const ALLOWED_PATHS = new Set([
  '/order',
  '/cancel-all',
]);
const ALLOWED_PATH_PREFIXES = [
  '/order/',        // DELETE /order/{id}
  '/cancel-orders', // POST /cancel-market-orders
];

// Simple in-memory rate limiter (per-IP, resets every minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

interface SignRequest {
  method: string;
  path: string;
  body?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  // Require origin header — reject requests with no origin (e.g. curl, scripts)
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Check content length (10KB max)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 10240) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  // Read builder credentials from env
  const apiKey = process.env.POLYMARKET_API_KEY;
  const apiSecret = process.env.POLYMARKET_API_SECRET;
  const passphrase = process.env.POLYMARKET_PASSPHRASE;

  if (!apiKey || !apiSecret || !passphrase) {
    return NextResponse.json(
      { error: 'Builder credentials not configured' },
      { status: 500 }
    );
  }

  // Parse request body
  let payload: SignRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { method, path, body } = payload;

  if (!method || !path) {
    return NextResponse.json(
      { error: 'method and path are required' },
      { status: 400 }
    );
  }

  // Validate method
  const upperMethod = method.toUpperCase();
  if (!['GET', 'POST', 'DELETE'].includes(upperMethod)) {
    return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
  }

  // Validate path — only sign known CLOB endpoints
  if (!ALLOWED_PATHS.has(path) && !ALLOWED_PATH_PREFIXES.some(p => path.startsWith(p))) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 400 });
  }

  // Build HMAC message: timestamp + method + path + body
  // Polymarket builder attribution uses unix seconds (per builder-signing-sdk)
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const message = timestamp + upperMethod + path + bodyStr;

  try {
    // Decode base64 secret
    let normalizedSecret = apiSecret.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalizedSecret.length % 4;
    if (pad === 2) normalizedSecret += '==';
    else if (pad === 3) normalizedSecret += '=';
    const secretBytes = new Uint8Array(Buffer.from(normalizedSecret, 'base64'));

    // Import key for HMAC-SHA256
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign
    const encoder = new TextEncoder();
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

    // URL-safe base64 (keep '=' padding per Polymarket spec)
    const base64Sig = Buffer.from(new Uint8Array(sig)).toString('base64');
    const urlSafeSig = base64Sig.replace(/\+/g, '-').replace(/\//g, '_');

    return NextResponse.json({
      POLY_BUILDER_SIGNATURE: urlSafeSig,
      POLY_BUILDER_TIMESTAMP: timestamp,
      POLY_BUILDER_API_KEY: apiKey,
      POLY_BUILDER_PASSPHRASE: passphrase,
    });
  } catch (err) {
    console.error('HMAC signing error:', err);
    return NextResponse.json({ error: 'Signing failed' }, { status: 500 });
  }
}
