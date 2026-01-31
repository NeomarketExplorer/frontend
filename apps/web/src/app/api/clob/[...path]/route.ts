import { NextRequest, NextResponse } from 'next/server';

const CLOB_API_URL = 'https://clob.polymarket.com';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();
  const endpoint = `/${path.join('/')}`;

  try {
    const response = await fetch(
      `${CLOB_API_URL}${endpoint}${queryString ? `?${queryString}` : ''}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        next: { revalidate: 10 }, // Cache for 10 seconds
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch ${endpoint}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
