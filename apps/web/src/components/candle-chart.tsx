'use client';

import { useEffect, useRef, useMemo } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  Time,
  CandlestickSeries,
  HistogramSeries,
} from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle, Skeleton, cn } from '@app/ui';
import type { Candle } from '@/lib/clickhouse';

interface CandleChartProps {
  candles: Candle[];
  isLoading?: boolean;
  className?: string;
  title?: string;
  height?: number;
  fillContainer?: boolean;
}

function formatCompactVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
}

export function CandleChart({
  candles,
  isLoading = false,
  className,
  title = 'Price',
  height = 300,
  fillContainer = false,
}: CandleChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Transform candle data for the chart (prices 0-1 -> cents)
  const { candleData, volumeData } = useMemo(() => {
    if (!candles || candles.length === 0) return { candleData: [], volumeData: [] };

    const sorted = [...candles].sort((a, b) => a.time - b.time);

    const up = 'rgb(34, 197, 94)';
    const down = 'rgb(239, 68, 68)';
    const upVol = 'rgba(34, 197, 94, 0.35)';
    const downVol = 'rgba(239, 68, 68, 0.35)';

    const cd: CandlestickData<Time>[] = [];
    const vd: HistogramData<Time>[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      const isUp = c.close >= c.open;

      const pointColor = isUp ? up : down;
      cd.push({
        time: c.time as Time,
        open: c.open * 100,
        high: c.high * 100,
        low: c.low * 100,
        close: c.close * 100,
        color: pointColor,
        borderColor: pointColor,
        wickColor: pointColor,
      });

      vd.push({
        time: c.time as Time,
        value: c.volume,
        color: isUp ? upVol : downVol,
      });
    }

    return { candleData: cd, volumeData: vd };
  }, [candles]);

  // Calculate price change from first to last candle
  const priceChange = useMemo(() => {
    if (candleData.length < 2) return null;
    const first = candleData[0].open;
    const last = candleData[candleData.length - 1].close;
    const change = last - first;
    const percentChange = first !== 0 ? (change / first) * 100 : 0;
    return {
      absolute: change,
      percent: percentChange,
      isPositive: change >= 0,
    };
  }, [candleData]);

  // Create chart + series (once on mount, or when height/fillContainer changes)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const initialWidth = container.clientWidth;
    const initialHeight = fillContainer ? container.clientHeight : height;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgb(156, 163, 175)',
        fontFamily: 'var(--font-mono)',
      },
      width: initialWidth,
      height: initialHeight,
      grid: {
        vertLines: { color: 'rgba(156, 163, 175, 0.1)' },
        horzLines: { color: 'rgba(156, 163, 175, 0.1)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(156, 163, 175, 0.2)',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: 'rgba(156, 163, 175, 0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: 'rgba(156, 163, 175, 0.5)',
          labelBackgroundColor: 'rgb(55, 65, 81)',
        },
        horzLine: {
          color: 'rgba(156, 163, 175, 0.5)',
          labelBackgroundColor: 'rgb(55, 65, 81)',
        },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: 'rgb(34, 197, 94)',
      downColor: 'rgb(239, 68, 68)',
      borderUpColor: 'rgb(34, 197, 94)',
      borderDownColor: 'rgb(239, 68, 68)',
      wickUpColor: 'rgb(34, 197, 94)',
      wickDownColor: 'rgb(239, 68, 68)',
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => `${price.toFixed(1)}\u00A2`,
      },
    });

    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'custom',
        formatter: (val: number) => formatCompactVolume(val),
      },
      priceScaleId: 'volume',
    });

    // Volume scale: overlay at the bottom, small height
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    volumeSeriesRef.current = volumeSeries;

    // Use ResizeObserver for both fillContainer and normal modes
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: h } = entry.contentRect;
        if (width > 0) {
          chart.applyOptions({
            width,
            ...(fillContainer ? { height: h } : {}),
          });
        }
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height, fillContainer]);

  // Update data incrementally (no chart recreation)
  useEffect(() => {
    if (candleSeriesRef.current && candleData.length > 0) {
      candleSeriesRef.current.setData(candleData);
    }
    if (volumeSeriesRef.current && volumeData.length > 0) {
      volumeSeriesRef.current.setData(volumeData);
    }
    if (candleData.length > 0) {
      chartRef.current?.timeScale().fitContent();
    }
  }, [candleData, volumeData]);

  const currentPrice =
    candleData.length > 0 ? candleData[candleData.length - 1].close : null;

  // fillContainer mode: no Card wrapper, just the chart div filling parent
  if (fillContainer) {
    if (isLoading) {
      return (
        <div className={cn('w-full h-full flex items-center justify-center', className)}>
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (candleData.length === 0) {
      return (
        <div className={cn('w-full h-full flex items-center justify-center', className)}>
          <span className="text-muted-foreground text-sm">No price data available</span>
        </div>
      );
    }
    return <div ref={chartContainerRef} className={cn('w-full h-full', className)} />;
  }

  // Normal Card-wrapped mode
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {currentPrice !== null && (
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xl sm:text-2xl font-bold">
                {currentPrice.toFixed(1)}&cent;
              </span>
              {priceChange && (
                <span
                  className={cn(
                    'text-xs sm:text-sm font-medium',
                    priceChange.isPositive ? 'text-positive' : 'text-negative'
                  )}
                >
                  {priceChange.isPositive ? '+' : ''}
                  {priceChange.absolute.toFixed(1)}&cent; (
                  {priceChange.isPositive ? '+' : ''}
                  {priceChange.percent.toFixed(1)}%)
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" style={{ height }}>
            <span className="sr-only">Loading chart...</span>
            <div className="relative h-full rounded-lg overflow-hidden">
              <Skeleton className="absolute inset-0 rounded-lg" />
              <div className="absolute inset-x-0 top-[20%] border-t border-muted-foreground/5" />
              <div className="absolute inset-x-0 top-[40%] border-t border-muted-foreground/5" />
              <div className="absolute inset-x-0 top-[60%] border-t border-muted-foreground/5" />
              <div className="absolute inset-x-0 top-[80%] border-t border-muted-foreground/5" />
              <div className="absolute right-2 top-[18%]">
                <Skeleton className="h-3 w-8" />
              </div>
              <div className="absolute right-2 top-[38%]">
                <Skeleton className="h-3 w-8" />
              </div>
              <div className="absolute right-2 top-[58%]">
                <Skeleton className="h-3 w-8" />
              </div>
              <div className="absolute right-2 top-[78%]">
                <Skeleton className="h-3 w-8" />
              </div>
            </div>
          </div>
        ) : candleData.length === 0 ? (
          <div
            className="flex items-center justify-center bg-muted/50 rounded-lg"
            style={{ height }}
          >
            <span className="text-muted-foreground">No price data available</span>
          </div>
        ) : (
          <div ref={chartContainerRef} style={{ height }} />
        )}
      </CardContent>
    </Card>
  );
}
