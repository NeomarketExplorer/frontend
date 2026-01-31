import { NextRequest, NextResponse } from 'next/server';

const INDEXER_URL = process.env.INDEXER_URL || 'http://127.0.0.1:3005';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const res = await fetch(`${INDEXER_URL}/events/${id}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
