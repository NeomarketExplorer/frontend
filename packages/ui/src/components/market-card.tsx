import * as React from 'react';
import { cn } from '../utils';

export interface MarketCardProps extends React.HTMLAttributes<HTMLDivElement> {
  question: string;
  image?: string;
  outcomes: Array<{
    name: string;
    price: number;
  }>;
  volume?: number;
  endDate?: string;
  category?: string;
  isLoading?: boolean;
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(1)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

function formatPrice(price: number): string {
  return `${(price * 100).toFixed(0)}¢`;
}

const MarketCard = React.forwardRef<HTMLDivElement, MarketCardProps>(
  (
    {
      className,
      question,
      image,
      outcomes,
      volume,
      endDate,
      category,
      isLoading,
      ...props
    },
    ref
  ) => {
    if (isLoading) {
      return (
        <div
          ref={ref}
          className={cn(
            'rounded-xl border bg-card p-4 animate-pulse',
            className
          )}
          {...props}
        >
          <div className="h-4 w-3/4 bg-muted rounded mb-3" />
          <div className="h-3 w-1/2 bg-muted rounded mb-4" />
          <div className="flex gap-2">
            <div className="h-8 flex-1 bg-muted rounded" />
            <div className="h-8 flex-1 bg-muted rounded" />
          </div>
        </div>
      );
    }

    const [yes, no] = outcomes.length >= 2
      ? [outcomes[0], outcomes[1]]
      : [outcomes[0], { name: 'No', price: 1 - (outcomes[0]?.price ?? 0.5) }];

    return (
      <div
        ref={ref}
        className={cn(
          'group rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/20 cursor-pointer',
          className
        )}
        {...props}
      >
        {/* Header */}
        <div className="flex gap-3 mb-3">
          {image && (
            <img
              src={image}
              alt=""
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {question}
            </h3>
            {category && (
              <span className="text-xs text-muted-foreground mt-1 inline-block">
                {category}
              </span>
            )}
          </div>
        </div>

        {/* Outcome buttons */}
        <div className="flex gap-2 mb-3">
          <button className="flex-1 py-2 px-3 rounded-lg bg-positive/10 hover:bg-positive/20 text-positive text-sm font-medium transition-colors">
            {yes.name} {formatPrice(yes.price)}
          </button>
          <button className="flex-1 py-2 px-3 rounded-lg bg-negative/10 hover:bg-negative/20 text-negative text-sm font-medium transition-colors">
            {no.name} {formatPrice(no.price)}
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {volume !== undefined && <span>{formatVolume(volume)} Vol</span>}
          {endDate && (
            <span>
              Ends {new Date(endDate).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    );
  }
);
MarketCard.displayName = 'MarketCard';

export { MarketCard };
