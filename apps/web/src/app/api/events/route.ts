import { NextRequest, NextResponse } from 'next/server';

const INDEXER_URL = process.env.INDEXER_URL || 'http://127.0.0.1:3005';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  const url = `${INDEXER_URL}/events${search}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
