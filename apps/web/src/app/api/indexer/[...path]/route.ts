import { NextRequest, NextResponse } from 'next/server';

const INDEXER_URL = process.env.INDEXER_URL || 'http://127.0.0.1:3005';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await context.params;
    const pathname = '/' + path.join('/');
    const search = request.nextUrl.search;
    const url = `${INDEXER_URL}${pathname}${search}`;

    const res = await fetch(url, { cache: 'no-store' });
    const contentType = res.headers.get('content-type') ?? '';
    const bodyText = await res.text();

    if (contentType.includes('application/json')) {
      const data = bodyText ? JSON.parse(bodyText) : null;
      return NextResponse.json(data, { status: res.status });
    }

    return new NextResponse(bodyText, {
      status: res.status,
      headers: contentType ? { 'content-type': contentType } : undefined,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Proxy failed', message: String(error) }, { status: 500 });
  }
}
