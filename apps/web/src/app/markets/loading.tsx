export default function Loading() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-gradient-to-b from-[var(--success)] to-[var(--danger)] rounded-full" />
            <div className="h-8 w-32 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
      </div>

      {/* Sort tabs skeleton */}
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
        <div className="h-8 w-16 bg-muted animate-pulse rounded" />
        <div className="h-8 w-20 bg-muted animate-pulse rounded" />
        <div className="h-8 w-16 bg-muted animate-pulse rounded" />
      </div>

      {/* Table skeleton */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Header */}
            <thead>
              <tr className="border-b border-[var(--card-border)]">
                <th className="text-left p-3">
                  <div className="h-3 w-14 bg-muted animate-pulse rounded" />
                </th>
                <th className="text-center p-3 w-24">
                  <div className="h-3 w-8 bg-muted animate-pulse rounded mx-auto" />
                </th>
                <th className="text-center p-3 w-24">
                  <div className="h-3 w-8 bg-muted animate-pulse rounded mx-auto" />
                </th>
                <th className="text-right p-3 w-28">
                  <div className="h-3 w-14 bg-muted animate-pulse rounded ml-auto" />
                </th>
                <th className="text-right p-3 w-28 hidden md:table-cell">
                  <div className="h-3 w-16 bg-muted animate-pulse rounded ml-auto" />
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-[var(--card-border)]/50">
                  <td className="p-3">
                    <div className="space-y-1.5">
                      <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                      <div className="h-1 w-1/2 bg-muted animate-pulse rounded-full" />
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="h-6 w-14 bg-muted animate-pulse rounded mx-auto" />
                  </td>
                  <td className="p-3 text-center">
                    <div className="h-6 w-14 bg-muted animate-pulse rounded mx-auto" />
                  </td>
                  <td className="p-3">
                    <div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" />
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
