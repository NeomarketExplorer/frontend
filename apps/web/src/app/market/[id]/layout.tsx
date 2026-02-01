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
    return {
      title: market.question,
      description:
        market.description ||
        `${market.question}${priceStr}. Trade on Neomarket.`,
      openGraph: {
        title: `${market.question}${priceStr}`,
        description:
          market.description || `Trade this market on Neomarket`,
        ...(market.image && {
          images: [{ url: market.image, width: 1200, height: 630 }],
        }),
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
