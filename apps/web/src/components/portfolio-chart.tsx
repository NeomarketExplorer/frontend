'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, AreaData, Time, AreaSeries } from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@app/ui';
import { usePortfolioHistory } from '@/hooks';
import type { Activity } from '@app/api';

type IntervalOption = '1W' | '1M' | '3M' | 'ALL';

interface IntervalConfig {
  interval: string;
  from: string | undefined;
}

const INTERVAL_OPTIONS: { label: IntervalOption; config: IntervalConfig }[] = [
  { label: '1W', config: { interval: '1h', from: daysAgo(7) } },
  { label: '1M', config: { interval: '6h', from: daysAgo(30) } },
  { label: '3M', config: { interval: '1d', from: daysAgo(90) } },
  { label: 'ALL', config: { interval: '1d', from: undefined } },
];

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

interface PortfolioChartProps {
  address: string;
  currentValue: number;
  activities?: Activity[];
  className?: string;
}

export function PortfolioChart({ address: _address, currentValue, activities, className }: PortfolioChartProps) {
  const [selectedInterval, setSelectedInterval] = useState<IntervalOption>('1M');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const intervalConfig = INTERVAL_OPTIONS.find((o) => o.label === selectedInterval)!.config;
  const { data: history, isLoading, isError } = usePortfolioHistory(
    intervalConfig.interval,
    intervalConfig.from,
  );

  const hasClickHouseData = !isError && history?.snapshots && history.snapshots.length > 0;

  // Build chart data from ClickHouse snapshots, or fall back to activity-based approximation
  const chartData = useMemo<AreaData<Time>[]>(() => {
    if (hasClickHouseData) {
      return mapSnapshotsToChartData(history!.snapshots, currentValue);
    }

    if (activities && activities.length > 0) {
      return buildCumulativeChartData(activities, currentValue);
    }

    return [];
  }, [hasClickHouseData, history, activities, currentValue]);

  // Calculate value change between first and last data points
  const valueChange = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    const change = last - first;
    const percentChange = first > 0 ? (change / first) * 100 : 0;
    return {
      absolute: change,
      percent: percentChange,
      isPositive: change >= 0,
    };
  }, [chartData]);

  const height = 200;

  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;

    const isPositive = valueChange?.isPositive ?? true;
    const lineColor = isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';
    const areaTopColor = isPositive ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
    const areaBottomColor = isPositive ? 'rgba(34, 197, 94, 0.0)' : 'rgba(239, 68, 68, 0.0)';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgb(156, 163, 175)',
        fontFamily: 'var(--font-mono)',
      },
      width: chartContainerRef.current.clientWidth,
      height,
      grid: {
        vertLines: { color: 'rgba(156, 163, 175, 0.1)' },
        horzLines: { color: 'rgba(156, 163, 175, 0.1)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(156, 163, 175, 0.2)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(156, 163, 175, 0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(156, 163, 175, 0.5)', labelBackgroundColor: 'rgb(55, 65, 81)' },
        horzLine: { color: 'rgba(156, 163, 175, 0.5)', labelBackgroundColor: 'rgb(55, 65, 81)' },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: areaTopColor,
      bottomColor: areaBottomColor,
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => `$${price.toFixed(2)}`,
      },
    });

    seriesRef.current = areaSeries;

    areaSeries.setData(chartData);
    chart.timeScale().fitContent();

    function handleResize() {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [chartData, valueChange?.isPositive]);

  // Update data when it changes
  useEffect(() => {
    if (seriesRef.current && chartData.length > 0) {
      seriesRef.current.setData(chartData);
      chartRef.current?.timeScale().fitContent();
    }
  }, [chartData]);

  const hasActivities = activities && activities.length > 0;
  const hasTrades = hasActivities && activities.some((a) => a.type === 'trade' && a.value != null);

  // Empty state: no ClickHouse data loading, no activity data at all
  if (!isLoading && !hasClickHouseData && !hasActivities) {
    return (
      <div className={className}>
        <div className="glass-card p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[var(--card)] mb-3">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[var(--foreground-muted)]" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="font-mono text-xs text-[var(--foreground-muted)]">No trading history yet</p>
        </div>
      </div>
    );
  }

  // Fallback path has activities but no plottable trades
  if (!isLoading && !hasClickHouseData && !hasTrades) {
    return (
      <div className={className}>
        <div className="glass-card p-6 text-center">
          <p className="font-mono text-xs text-[var(--foreground-muted)]">No trading history yet</p>
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <CardTitle className="text-base">Portfolio Value</CardTitle>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl font-bold font-mono">
              ${currentValue.toFixed(2)}
            </span>
            {valueChange && (
              <span
                className="text-xs sm:text-sm font-medium font-mono"
                style={{
                  color: valueChange.isPositive ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {valueChange.isPositive ? '+' : ''}${valueChange.absolute.toFixed(2)}
                {valueChange.percent !== 0 && (
                  <> ({valueChange.isPositive ? '+' : ''}{valueChange.percent.toFixed(1)}%)</>
                )}
              </span>
            )}
          </div>
        </div>
        {/* Interval selector */}
        <div className="flex items-center gap-1 mt-2">
          {INTERVAL_OPTIONS.map((option) => (
            <button
              key={option.label}
              onClick={() => setSelectedInterval(option.label)}
              className={`font-mono text-[0.65rem] px-2.5 py-1 transition-colors ${
                selectedInterval === option.label
                  ? 'bg-[var(--accent)] text-[var(--background)] font-bold'
                  : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] bg-[var(--card)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ height, background: 'rgba(156, 163, 175, 0.05)' }}
          >
            <span className="font-mono text-xs text-[var(--foreground-muted)]">
              Loading chart data...
            </span>
          </div>
        ) : chartData.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ height, background: 'rgba(156, 163, 175, 0.05)' }}
          >
            <span className="font-mono text-xs text-[var(--foreground-muted)]">
              Not enough data to chart
            </span>
          </div>
        ) : (
          <div ref={chartContainerRef} style={{ height }} />
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Data mapping helpers
// ---------------------------------------------------------------------------

function mapSnapshotsToChartData(
  snapshots: { timestamp: number; totalValue: number }[],
  currentValue: number,
): AreaData<Time>[] {
  if (snapshots.length === 0) return [];

  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const seenTimes = new Set<number>();
  const points: AreaData<Time>[] = [];

  for (const snap of sorted) {
    const time = Math.floor(snap.timestamp);
    if (seenTimes.has(time)) continue;
    seenTimes.add(time);
    points.push({
      time: time as Time,
      value: Math.max(snap.totalValue, 0),
    });
  }

  // Append current value as the latest point
  const now = Math.floor(Date.now() / 1000);
  if (!seenTimes.has(now)) {
    points.push({
      time: now as Time,
      value: Math.max(currentValue, 0),
    });
  }

  return points;
}

function buildCumulativeChartData(
  activities: Activity[],
  currentValue: number,
): AreaData<Time>[] {
  const trades = activities
    .filter((a) => a.type === 'trade' && a.value != null && a.timestamp)
    .map((a) => ({
      time: Math.floor(new Date(a.timestamp).getTime() / 1000),
      value: a.value!,
      side: a.side,
    }))
    .sort((a, b) => a.time - b.time);

  if (trades.length === 0) return [];

  let cumulative = 0;
  const points: AreaData<Time>[] = [];
  const seenTimes = new Set<number>();

  for (const trade of trades) {
    if (trade.side === 'BUY') {
      cumulative += trade.value;
    } else if (trade.side === 'SELL') {
      cumulative -= trade.value;
    } else {
      cumulative += trade.value;
    }

    if (seenTimes.has(trade.time)) {
      const lastIdx = points.length - 1;
      if (lastIdx >= 0) {
        points[lastIdx] = {
          time: trade.time as Time,
          value: Math.max(cumulative, 0),
        };
      }
    } else {
      seenTimes.add(trade.time);
      points.push({
        time: trade.time as Time,
        value: Math.max(cumulative, 0),
      });
    }
  }

  const now = Math.floor(Date.now() / 1000);
  if (!seenTimes.has(now)) {
    points.push({
      time: now as Time,
      value: Math.max(currentValue, 0),
    });
  }

  return points;
}
