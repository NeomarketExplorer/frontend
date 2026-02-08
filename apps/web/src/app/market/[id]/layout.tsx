import type { Metadata } from 'next';
import { getMarket } from '@/lib/indexer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const market = await getMarket(id);
    const yesPrice = market.outcomePrices?.[0];
    const priceStr =
      yesPrice != null ? ` — YES ${(yesPrice * 100).toFixed(0)}c` : '';
    const rawDescription =
      market.description ||
      `${market.question}${priceStr}. Trade on Neomarket.`;
    const description =
      rawDescription.length > 160
        ? rawDescription.slice(0, 157) + '...'
        : rawDescription;
    return {
      title: market.question,
      description,
      openGraph: {
        title: `${market.question}${priceStr}`,
        description,
        type: 'article',
        url: `https://neomarket.bet/market/${id}`,
        ...(market.image && {
          images: [{ url: market.image, width: 1200, height: 630 }],
        }),
      },
      twitter: {
        card: market.image ? 'summary_large_image' : 'summary',
        title: `${market.question}${priceStr}`,
        description,
        ...(market.image && { images: [market.image] }),
      },
    };
  } catch {
    return { title: 'Market' };
  }
}

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
