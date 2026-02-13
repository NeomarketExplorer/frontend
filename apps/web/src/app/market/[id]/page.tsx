import { MarketTerminal } from '@/components/market/market-terminal';

interface MarketPageProps {
  params: Promise<{ id: string }>;
}

export default async function MarketPage({ params }: MarketPageProps) {
  const { id } = await params;
  return <MarketTerminal id={id} />;
}
