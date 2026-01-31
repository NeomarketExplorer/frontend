export interface OutcomeEntry {
  label: string;
  price: number | null;
  index: number;
  key: string;
  color: string;
}

const OUTCOME_COLORS = [
  '#00ff94',
  '#ff3355',
  '#00c8ff',
  '#f5d90a',
  '#ff7ab6',
  '#3ddc97',
  '#f97316',
  '#60a5fa',
];

const YES_COLOR = '#00ff94';
const NO_COLOR = '#ff3355';

function safeOutcomeLabel(label: string | null | undefined, index: number): string {
  const trimmed = label?.trim();
  if (trimmed) return trimmed;
  return `Outcome ${index + 1}`;
}

export function isYesOutcome(label: string | null | undefined): boolean {
  return label?.trim().toLowerCase() === 'yes';
}

export function isNoOutcome(label: string | null | undefined): boolean {
  return label?.trim().toLowerCase() === 'no';
}

export function isBinaryYesNo(outcomes: string[] | null | undefined): boolean {
  if (!outcomes || outcomes.length !== 2) return false;
  const lower = outcomes.map((outcome) => outcome.trim().toLowerCase());
  return lower.includes('yes') && lower.includes('no');
}

export function getOutcomeColor(label: string | null | undefined, index: number): string {
  if (isYesOutcome(label)) return YES_COLOR;
  if (isNoOutcome(label)) return NO_COLOR;
  return OUTCOME_COLORS[index % OUTCOME_COLORS.length];
}

export function buildOutcomeEntries(
  outcomes: string[] | null | undefined,
  prices?: Array<string | number | null | undefined>
): OutcomeEntry[] {
  if (!outcomes || outcomes.length === 0) return [];

  return outcomes.map((outcome, index) => {
    const label = safeOutcomeLabel(outcome, index);
    const rawPrice = prices?.[index];
    const parsed =
      rawPrice == null
        ? null
        : typeof rawPrice === 'string'
          ? parseFloat(rawPrice)
          : rawPrice;
    const price = Number.isFinite(parsed) ? (parsed as number) : null;

    return {
      label,
      price,
      index,
      key: `outcome-${index}`,
      color: getOutcomeColor(label, index),
    };
  });
}

export function getMaxOutcomePrice(entries: OutcomeEntry[]): number {
  let max = 0;
  for (const entry of entries) {
    if (entry.price != null && entry.price > max) {
      max = entry.price;
    }
  }
  return max;
}
