import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://neomarket.bet',
  'https://www.neomarket.bet',
  'http://localhost:3000',
];

interface SignRequest {
  method: string;
  path: string;
  body?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  // Check origin
  const origin = request.headers.get('origin') ?? '';
  if (origin && !ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

  // Build HMAC message: timestamp + method + path + body
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const message = timestamp + method + path + bodyStr;

  try {
    // Decode base64 secret
    let normalizedSecret = apiSecret.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalizedSecret.length % 4;
    if (pad === 2) normalizedSecret += '==';
    else if (pad === 3) normalizedSecret += '=';
    const secretBytes = Uint8Array.from(atob(normalizedSecret), c => c.charCodeAt(0));

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

    // URL-safe base64
    const base64Sig = btoa(String.fromCharCode(...new Uint8Array(sig)));
    const urlSafeSig = base64Sig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

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
