import { isBinaryYesNo } from './outcomes';

/**
 * Extract short names from a set of questions that share a common pattern.
 *
 * Example:
 *   "Will John Thune win the 2028 Republican presidential nomination?"
 *   "Will Mike Pence win the 2028 Republican presidential nomination?"
 *   → ["John Thune", "Mike Pence"]
 */
export function extractShortNames(questions: string[]): string[] | null {
  if (questions.length < 2) return null;

  // Find longest common prefix (character by character)
  let prefix = '';
  const first = questions[0];
  for (let i = 0; i < first.length; i++) {
    const ch = first[i];
    if (questions.every((q) => q[i] === ch)) {
      prefix += ch;
    } else {
      break;
    }
  }

  // Find longest common suffix (reverse character by character)
  let suffix = '';
  const shortest = questions.reduce((a, b) => (a.length < b.length ? a : b));
  for (let i = 1; i <= shortest.length; i++) {
    const ch = first[first.length - i];
    if (questions.every((q) => q[q.length - i] === ch)) {
      suffix = ch + suffix;
    } else {
      break;
    }
  }

  // Validate: prefix+suffix must cover at least 30% of the shortest question
  if ((prefix.length + suffix.length) / shortest.length < 0.3) return null;

  // Extract variable part for each question
  const names = questions.map((q) =>
    q.slice(prefix.length, suffix.length > 0 ? q.length - suffix.length : undefined).trim(),
  );

  // Validate: all extracted names must be non-empty and <= 80 chars
  if (names.some((n) => n.length === 0 || n.length > 80)) return null;

  return names;
}

/**
 * Determine whether an event with these markets should render as a compact
 * ranked table instead of full-width MarketCards.
 */
export function shouldUseCompactTable(
  markets: { question: string; outcomes: string[] }[],
): boolean {
  if (markets.length < 5) return false;
  if (!markets.every((m) => isBinaryYesNo(m.outcomes))) return false;

  const names = extractShortNames(markets.map((m) => m.question));
  return names !== null;
}
