/**
 * Number formatting utilities for trading UI
 *
 * Provides consistent formatting for prices, percentages, volumes,
 * currencies, shares, and compact numbers throughout the application.
 */

/**
 * Format a price value with specified decimal places
 *
 * @param value - The price value to format
 * @param decimals - Number of decimal places (default: 4)
 * @returns Formatted price string
 *
 * @example
 * formatPrice(0.6523) // "0.6523"
 * formatPrice(0.12) // "0.1200"
 * formatPrice(0.6523, 2) // "0.65"
 */
export function formatPrice(value: number, decimals: number = 4): string {
  return value.toFixed(decimals);
}

/**
 * Format a percentage value with sign indicator
 *
 * @param value - The percentage value to format
 * @returns Formatted percentage string with +/- sign
 *
 * @example
 * formatPercentage(12.5) // "+12.5%"
 * formatPercentage(-3.2) // "-3.2%"
 * formatPercentage(0) // "0.0%"
 */
export function formatPercentage(value: number): string {
  const formatted = Math.abs(value).toFixed(1);
  if (value > 0) {
    return `+${formatted}%`;
  } else if (value < 0) {
    return `-${formatted}%`;
  }
  return `${formatted}%`;
}

/**
 * Format a volume value with K, M, B suffixes
 *
 * @param value - The volume value to format
 * @returns Formatted volume string with appropriate suffix
 *
 * @example
 * formatVolume(523000) // "523K"
 * formatVolume(1200000) // "1.2M"
 * formatVolume(2100000000) // "2.1B"
 * formatVolume(500) // "500"
 */
export function formatVolume(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    const formatted = absValue / 1_000_000_000;
    return `${sign}${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)}B`;
  }
  if (absValue >= 1_000_000) {
    const formatted = absValue / 1_000_000;
    return `${sign}${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    const formatted = absValue / 1_000;
    return `${sign}${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)}K`;
  }
  return `${sign}${Math.round(absValue)}`;
}

/**
 * Format a currency value with symbol and thousands separators
 * Uses compact notation for large values (1M+)
 *
 * @param value - The currency value to format
 * @param currency - Currency code (default: "USD")
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1234.56) // "$1,234.56"
 * formatCurrency(1200000) // "$1.2M"
 * formatCurrency(1234.56, "EUR") // "EUR1,234.56"
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const symbol = currency === 'USD' ? '$' : currency;

  // Use compact notation for large values
  if (absValue >= 1_000_000_000) {
    const formatted = absValue / 1_000_000_000;
    return `${sign}${symbol}${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)}B`;
  }
  if (absValue >= 1_000_000) {
    const formatted = absValue / 1_000_000;
    return `${sign}${symbol}${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)}M`;
  }

  // Use Intl.NumberFormat for standard currency formatting
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(value);
}

/**
 * Format a share quantity with thousands separators
 *
 * @param value - The number of shares to format
 * @returns Formatted share quantity string
 *
 * @example
 * formatShares(100) // "100"
 * formatShares(1234) // "1,234"
 * formatShares(1234567) // "1,234,567"
 */
export function formatShares(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

/**
 * Format a number in compact notation with K, M, B suffixes
 *
 * @param value - The number to format
 * @returns Formatted compact number string
 *
 * @example
 * formatCompact(1200) // "1.2K"
 * formatCompact(3400000) // "3.4M"
 * formatCompact(500) // "500"
 */
export function formatCompact(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    const formatted = absValue / 1_000_000_000;
    return `${sign}${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)}B`;
  }
  if (absValue >= 1_000_000) {
    const formatted = absValue / 1_000_000;
    return `${sign}${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    const formatted = absValue / 1_000;
    return `${sign}${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)}K`;
  }
  return `${sign}${Math.round(absValue)}`;
}
