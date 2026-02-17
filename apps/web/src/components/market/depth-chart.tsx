'use client';

import { useMemo } from 'react';

interface OrderbookLevel {
  price: number;
  size: number;
}

interface DepthChartProps {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  midpoint: number | null | undefined;
}

export function DepthChart({ bids, asks, midpoint }: DepthChartProps) {
  const { bidPoints, askPoints, priceMin, priceMax, maxCum, midX } = useMemo(() => {
    if (!bids.length && !asks.length) {
      return { bidPoints: [], askPoints: [], priceMin: 0, priceMax: 1, maxCum: 1, midX: 0.5 };
    }

    // Build cumulative bid curve (descending price → ascending cumulative)
    const sortedBids = [...bids].sort((a, b) => b.price - a.price);
    let cum = 0;
    const bidCum = sortedBids.map((l) => {
      cum += l.size;
      return { price: l.price, cumSize: cum };
    });

    // Build cumulative ask curve (ascending price → ascending cumulative)
    const sortedAsks = [...asks].sort((a, b) => a.price - b.price);
    cum = 0;
    const askCum = sortedAsks.map((l) => {
      cum += l.size;
      return { price: l.price, cumSize: cum };
    });

    const allPrices = [...bidCum.map((p) => p.price), ...askCum.map((p) => p.price)];
    const pMin = Math.min(...allPrices);
    const pMax = Math.max(...allPrices);
    const mCum = Math.max(bidCum[bidCum.length - 1]?.cumSize ?? 0, askCum[askCum.length - 1]?.cumSize ?? 0, 1);

    const mid = midpoint ?? (pMin + pMax) / 2;
    const range = pMax - pMin || 0.01;
    const mX = Math.max(0, Math.min(1, (mid - pMin) / range));

    return { bidPoints: bidCum, askPoints: askCum, priceMin: pMin, priceMax: pMax, maxCum: mCum, midX: mX };
  }, [bids, asks, midpoint]);

  if (!bidPoints.length && !askPoints.length) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        No depth data
      </div>
    );
  }

  const W = 400;
  const H = 200;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 20;
  const PAD_X = 4;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const range = priceMax - priceMin || 0.01;

  function toX(price: number) {
    return PAD_X + ((price - priceMin) / range) * chartW;
  }
  function toY(cumSize: number) {
    return PAD_TOP + chartH - (cumSize / maxCum) * chartH;
  }

  // Build SVG path for bids (step function, right-to-left)
  const bidPath = buildStepPath(bidPoints, toX, toY, PAD_TOP + chartH, 'bid');
  const askPath = buildStepPath(askPoints, toX, toY, PAD_TOP + chartH, 'ask');

  const midLineX = PAD_X + midX * chartW;

  // Grid lines (4 horizontal)
  const gridLines = [0.25, 0.5, 0.75].map((frac) => {
    const y = PAD_TOP + chartH * (1 - frac);
    const label = (maxCum * frac).toFixed(0);
    return { y, label };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      {/* Grid lines */}
      {gridLines.map((g) => (
        <g key={g.y}>
          <line
            x1={PAD_X} y1={g.y} x2={W - PAD_X} y2={g.y}
            stroke="currentColor" strokeOpacity={0.08} strokeDasharray="2 4"
          />
          <text
            x={W - PAD_X - 2} y={g.y - 2}
            textAnchor="end" fill="currentColor" fillOpacity={0.3}
            fontSize={8} fontFamily="monospace"
          >
            {g.label}
          </text>
        </g>
      ))}

      {/* Baseline */}
      <line
        x1={PAD_X} y1={PAD_TOP + chartH} x2={W - PAD_X} y2={PAD_TOP + chartH}
        stroke="currentColor" strokeOpacity={0.1}
      />

      {/* Bid area (green) */}
      {bidPath && (
        <>
          <path d={bidPath} fill="var(--success)" fillOpacity={0.15} stroke="none" />
          <path d={bidPath} fill="none" stroke="var(--success)" strokeWidth={1.5} strokeOpacity={0.8} />
        </>
      )}

      {/* Ask area (red) */}
      {askPath && (
        <>
          <path d={askPath} fill="var(--danger)" fillOpacity={0.15} stroke="none" />
          <path d={askPath} fill="none" stroke="var(--danger)" strokeWidth={1.5} strokeOpacity={0.8} />
        </>
      )}

      {/* Midpoint line */}
      <line
        x1={midLineX} y1={PAD_TOP} x2={midLineX} y2={PAD_TOP + chartH}
        stroke="var(--accent)" strokeWidth={1} strokeOpacity={0.5} strokeDasharray="4 3"
      />

      {/* Price labels */}
      <text
        x={PAD_X + 2} y={H - 4}
        fill="currentColor" fillOpacity={0.4} fontSize={8} fontFamily="monospace"
      >
        {priceMin.toFixed(2)}
      </text>
      <text
        x={midLineX} y={H - 4}
        textAnchor="middle" fill="var(--accent)" fillOpacity={0.6} fontSize={8} fontFamily="monospace"
      >
        {(midpoint ?? (priceMin + priceMax) / 2).toFixed(2)}
      </text>
      <text
        x={W - PAD_X - 2} y={H - 4}
        textAnchor="end" fill="currentColor" fillOpacity={0.4} fontSize={8} fontFamily="monospace"
      >
        {priceMax.toFixed(2)}
      </text>
    </svg>
  );
}

function buildStepPath(
  points: { price: number; cumSize: number }[],
  toX: (p: number) => number,
  toY: (c: number) => number,
  baselineY: number,
  _side: 'bid' | 'ask',
): string | null {
  if (!points.length) return null;

  const parts: string[] = [];

  // Start at the first price on the baseline
  parts.push(`M${toX(points[0].price)},${baselineY}`);

  // Step function: vertical to cumSize, then horizontal to next price
  for (let i = 0; i < points.length; i++) {
    const x = toX(points[i].price);
    const y = toY(points[i].cumSize);
    // Vertical step up to this level
    parts.push(`L${x},${y}`);
    // Horizontal step to next price (if exists)
    if (i < points.length - 1) {
      const nextX = toX(points[i + 1].price);
      parts.push(`L${nextX},${y}`);
    }
  }

  // Close back to baseline at last price
  parts.push(`L${toX(points[points.length - 1].price)},${baselineY}`);
  parts.push('Z');

  return parts.join(' ');
}
