'use client';

import { useEffect, useRef, useMemo } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, AreaData, Time, AreaSeries } from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle, cn } from '@app/ui';

interface PriceChartProps {
  data: Array<{ t: number; p: number }>;
  isLoading?: boolean;
  className?: string;
  title?: string;
  height?: number;
}

export function PriceChart({
  data,
  isLoading = false,
  className,
  title = 'Price',
  height = 300
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  // Transform data for the chart
  const chartData = useMemo<AreaData<Time>[]>(() => {
    if (!data || data.length === 0) return [];

    return data
      .map(point => ({
        time: point.t as Time,
        value: point.p * 100, // Convert to cents
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));
  }, [data]);

  // Calculate price change
  const priceChange = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    const change = last - first;
    const percentChange = (change / first) * 100;
    return {
      absolute: change,
      percent: percentChange,
      isPositive: change >= 0,
    };
  }, [chartData]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isPositive = priceChange?.isPositive ?? true;
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
        formatter: (price: number) => `${price.toFixed(1)}¢`,
      },
    });

    seriesRef.current = areaSeries;

    if (chartData.length > 0) {
      areaSeries.setData(chartData);
      chart.timeScale().fitContent();
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [chartData, height, priceChange?.isPositive]);

  // Update data when it changes
  useEffect(() => {
    if (seriesRef.current && chartData.length > 0) {
      seriesRef.current.setData(chartData);
      chartRef.current?.timeScale().fitContent();
    }
  }, [chartData]);

  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].value : null;

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {currentPrice !== null && (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">{currentPrice.toFixed(1)}¢</span>
              {priceChange && (
                <span className={cn(
                  'text-sm font-medium',
                  priceChange.isPositive ? 'text-positive' : 'text-negative'
                )}>
                  {priceChange.isPositive ? '+' : ''}{priceChange.absolute.toFixed(1)}¢
                  ({priceChange.isPositive ? '+' : ''}{priceChange.percent.toFixed(1)}%)
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div
            className="flex items-center justify-center bg-muted/50 rounded-lg animate-pulse"
            style={{ height }}
          >
            <span className="text-muted-foreground">Loading chart...</span>
          </div>
        ) : chartData.length === 0 ? (
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
