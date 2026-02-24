import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL;
  if (!CLICKHOUSE_URL) {
    return NextResponse.json({ error: 'CLICKHOUSE_URL env var is not configured' }, { status: 500 });
  }

  try {
    const { path } = await context.params;
    const pathname = '/' + path.join('/');
    const search = request.nextUrl.search;
    const url = `${CLICKHOUSE_URL}${pathname}${search}`;

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
    console.error('ClickHouse proxy error:', error);
    return NextResponse.json({ error: 'Proxy failed', message: String(error) }, { status: 500 });
  }
}
