import { type IndexerMarket, isPlaceholderMarket } from '@/lib/indexer';
import { buildOutcomeEntries } from '@/lib/outcomes';

export interface Opportunity {
  market: IndexerMarket;
  recommendedOutcome: string;
  outcomeIndex: number;
  price: number;
  daysToExpiry: number;
  grossReturn: number;
  annualizedReturn: number;
}

export interface OpportunityOptions {
  minProbability?: number;
  maxDaysToExpiry?: number;
  sortBy?: 'apr' | 'expiry' | 'probability' | 'volume';
}

const MIN_VOLUME = 1000;

export function calculateDaysToExpiry(endDateIso: string): number {
  const end = new Date(endDateIso).getTime();
  if (Number.isNaN(end)) return NaN;
  return (end - Date.now()) / (1000 * 60 * 60 * 24);
}

export function calculateGrossReturn(price: number): number {
  return (1 - price) / price;
}

export function calculateAnnualizedReturn(price: number, days: number): number {
  if (days <= 0) return 0;
  return ((1 - price) / price) * (365 / days);
}

export function buildOpportunities(
  markets: IndexerMarket[],
  options: OpportunityOptions = {}
): Opportunity[] {
  const {
    minProbability = 0.7,
    maxDaysToExpiry = 30,
    sortBy = 'apr',
  } = options;

  const results: Opportunity[] = [];

  for (const market of markets) {
    if (isPlaceholderMarket(market)) continue;
    if (market.closed) continue;
    if (!market.endDateIso) continue;
    if (market.volume < MIN_VOLUME) continue;

    const days = calculateDaysToExpiry(market.endDateIso);
    if (!Number.isFinite(days) || days <= 0 || days > maxDaysToExpiry) continue;

    const outcomes = buildOutcomeEntries(market.outcomes, market.outcomePrices);
    if (outcomes.length === 0) continue;

    // Find the highest-priced outcome
    let bestOutcome = outcomes[0];
    for (const o of outcomes) {
      if (o.price != null && (bestOutcome.price == null || o.price > bestOutcome.price)) {
        bestOutcome = o;
      }
    }

    const price = bestOutcome.price;
    if (price == null || price < minProbability || price >= 1.0 || price <= 0.0) continue;

    results.push({
      market,
      recommendedOutcome: bestOutcome.label,
      outcomeIndex: bestOutcome.index,
      price,
      daysToExpiry: days,
      grossReturn: calculateGrossReturn(price),
      annualizedReturn: calculateAnnualizedReturn(price, days),
    });
  }

  results.sort((a, b) => {
    switch (sortBy) {
      case 'apr':
        return b.annualizedReturn - a.annualizedReturn;
      case 'expiry':
        return a.daysToExpiry - b.daysToExpiry;
      case 'probability':
        return b.price - a.price;
      case 'volume':
        return b.market.volume - a.market.volume;
      default:
        return b.annualizedReturn - a.annualizedReturn;
    }
  });

  return results;
}

export function formatAnnualizedReturn(apr: number): string {
  const pct = apr * 100;
  if (pct > 9999) return '9,999%+';
  if (pct >= 1000) return `${pct.toLocaleString('en-US', { maximumFractionDigits: 0 })}%`;
  return `${pct.toFixed(1)}%`;
}

export function formatGrossReturn(ret: number): string {
  return `+${(ret * 100).toFixed(1)}%`;
}

export function formatDaysToExpiry(days: number): string {
  if (days < 1) return '< 1d';
  return `${Math.floor(days)}d`;
}
