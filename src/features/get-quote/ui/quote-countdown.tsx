import { QUOTE_TTL_MS } from '@shared/config';
import { cn } from '@shared/lib';
import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

interface QuoteCountdownProps {
  /** TanStack Query's dataUpdatedAt for the quote. */
  updatedAt: number;
  className?: string;
}

/** Seconds until the auto-refresh kicks in; turns amber when nearly stale. */
export function QuoteCountdown({ updatedAt, className }: QuoteCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  if (!updatedAt) return null;

  const secondsLeft = Math.max(0, Math.ceil((updatedAt + QUOTE_TTL_MS - now) / 1_000));

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-muted-foreground text-xs tabular-nums',
        secondsLeft <= 5 && 'text-warning',
        className
      )}
    >
      <Clock className="h-3 w-3" aria-hidden />
      {secondsLeft > 0 ? `Quote refreshes in ${secondsLeft}s` : 'Refreshing quote…'}
    </span>
  );
}
