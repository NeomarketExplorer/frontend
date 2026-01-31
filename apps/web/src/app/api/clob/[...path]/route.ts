import { NextRequest, NextResponse } from 'next/server';

const CLOB_API_URL = 'https://clob.polymarket.com';

/** Forward POLY_* headers from the client request to the CLOB API */
function extractPolyHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    const upper = key.toUpperCase();
    if (upper.startsWith('POLY_') || upper.startsWith('POLY-')) {
      // Normalize: browsers lowercase headers, CLOB expects uppercase POLY_*
      const normalized = upper.replace(/-/g, '_');
      headers[normalized] = value;
    }
  });
  return headers;
}

async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
  method: string
) {
  const { path } = await params;
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();
  const endpoint = `/${path.join('/')}`;
  const url = `${CLOB_API_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;

  const polyHeaders = extractPolyHeaders(request);
  const hasAuth = Object.keys(polyHeaders).length > 0;

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...polyHeaders,
      },
    };

    // Forward body for POST/PUT/PATCH
    if (method !== 'GET' && method !== 'DELETE') {
      try {
        const body = await request.text();
        if (body) fetchOptions.body = body;
      } catch {
        // No body
      }
    }

    // Don't cache authenticated requests
    if (!hasAuth) {
      (fetchOptions as Record<string, unknown>).next = { revalidate: 10 };
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return new NextResponse(text, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.text();
    return new NextResponse(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`CLOB proxy error ${method} ${endpoint}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context, 'GET');
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context, 'POST');
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context, 'DELETE');
}
