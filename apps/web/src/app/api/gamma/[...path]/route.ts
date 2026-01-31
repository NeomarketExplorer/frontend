import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_URL = 'https://gamma-api.polymarket.com';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();
  const endpoint = `/${path.join('/')}`;

  try {
    const url = `${GAMMA_API_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;
    console.log('[Gamma Proxy] Fetching:', url);

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      console.error('[Gamma Proxy] Error:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Failed to fetch ${endpoint}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[Gamma Proxy] Error fetching ${endpoint}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
