export default function Loading() {
  return (
    <div>
      {/* Market header */}
      <div className="flex gap-4 mb-6">
        {/* Image placeholder */}
        <div className="w-16 h-16 bg-muted animate-pulse rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          {/* Question title */}
          <div className="h-7 w-3/4 bg-muted animate-pulse rounded" />
          {/* Meta badges */}
          <div className="flex items-center gap-3">
            <div className="h-5 w-16 bg-muted animate-pulse rounded" />
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-4 w-28 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Chart + Orderbook */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chart interval buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-end gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-7 w-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
            {/* Chart placeholder */}
            <div className="h-[280px] bg-[var(--card)] border border-[var(--card-border)] rounded-lg animate-pulse" />
          </div>

          {/* Orderbook / Trades card */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
            {/* Tab header */}
            <div className="p-4 border-b border-[var(--card-border)]">
              <div className="flex gap-2">
                <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </div>
            </div>
            {/* Orderbook content */}
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-10 bg-muted animate-pulse rounded" />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-10 bg-muted animate-pulse rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column - Trade panel */}
        <div>
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 space-y-4 sticky top-20">
            {/* Title + balance */}
            <div className="flex items-center justify-between">
              <div className="h-5 w-14 bg-muted animate-pulse rounded" />
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </div>
            {/* Market / Limit toggle */}
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted/50 rounded-md">
              <div className="h-8 bg-muted animate-pulse rounded" />
              <div className="h-8 bg-muted/30 animate-pulse rounded" />
            </div>
            {/* Outcome buttons */}
            <div className="grid grid-cols-2 gap-2">
              <div className="h-10 bg-muted animate-pulse rounded" />
              <div className="h-10 bg-muted animate-pulse rounded" />
            </div>
            {/* Buy / Sell buttons */}
            <div className="grid grid-cols-2 gap-2">
              <div className="h-10 bg-muted animate-pulse rounded" />
              <div className="h-10 bg-muted animate-pulse rounded" />
            </div>
            {/* Price input */}
            <div className="space-y-1.5">
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              <div className="h-10 w-full bg-muted animate-pulse rounded" />
            </div>
            {/* Size input */}
            <div className="space-y-1.5">
              <div className="h-4 w-14 bg-muted animate-pulse rounded" />
              <div className="h-10 w-full bg-muted animate-pulse rounded" />
            </div>
            {/* Estimate box */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                <div className="h-3 w-12 bg-muted animate-pulse rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                <div className="h-3 w-12 bg-muted animate-pulse rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                <div className="h-3 w-12 bg-muted animate-pulse rounded" />
              </div>
            </div>
            {/* Submit button */}
            <div className="h-11 w-full bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
