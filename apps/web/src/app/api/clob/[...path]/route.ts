import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const CLOB_API_URL = 'https://clob.polymarket.com';

/** Forward POLY_* headers from the client request to the CLOB API */
function extractPolyHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const upper = key.toUpperCase();
    if (upper.startsWith('POLY_') || upper.startsWith('POLY-')) {
      // Normalize: browsers lowercase headers, CLOB expects uppercase POLY_*
      const normalized = upper.replace(/-/g, '_');
      headers.set(normalized, value);
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
  const hasAuth = Array.from(polyHeaders.keys()).length > 0;

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: polyHeaders,
    };

    const contentType = request.headers.get('content-type');
    if (contentType) polyHeaders.set('Content-Type', contentType);

    // Forward body for non-GET/HEAD
    if (method !== 'GET' && method !== 'HEAD') {
      const body = await request.text();
      if (body) fetchOptions.body = body;
    }

    // Don't cache authenticated requests
    if (!hasAuth) {
      (fetchOptions as Record<string, unknown>).next = { revalidate: 10 };
    } else {
      fetchOptions.cache = 'no-store';
    }

    const response = await fetch(url, fetchOptions);

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type':
          response.headers.get('content-type') ?? 'application/json',
      },
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
